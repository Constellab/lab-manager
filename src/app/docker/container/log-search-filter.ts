import { StringDecoder } from 'string_decoder';
import { LogStream } from '../docker.class';
import {
  LOG_SEARCH_TIMEOUT_MS,
  LogSearchQueryParams,
  LogSearchResult,
  LogSearchTruncationReason,
} from './log-search.dto';

/**
 * Filtering of the log lines of a container, steps 2 to 5 of the documented order of operations :
 *
 * 1. `docker logs --timestamps [--since] [--until]`  (done by the caller, gives the time window)
 * 2. filter to stderr if errorsOnly
 * 3. filter by pattern, keeping contextLines around each match
 * 4. keep the LAST `tail` lines of the result of step 3
 * 5. truncate at maxBytes, preserving whole lines
 *
 * Step 4 is applied to the filtered set and never by `docker logs --tail`: on a container that has
 * been crash looping for an hour, "the last 200 lines that contain X" is the answer and "X within
 * the last 200 lines" is empty.
 *
 * Lines are pushed one by one and only what can still end up in the response is retained, so the
 * memory used stays bounded by `tail` whatever the size of the log.
 */

export interface LogSearchFilterOptions {
  /** Hard ceiling on the filtering step. */
  timeoutMs?: number;
  /** Injectable clock, so that the timeout can be tested without waiting for it. */
  now?: () => number;
}

/** Sort key of a line, docker timestamps being nanosecond precise. */
interface LineTime {
  epochMs: number;
  nanos: number;
}

/** A parsed docker timestamp : its sort key, and the text as docker wrote it. */
interface LineTimestamp {
  raw: string;
  time: LineTime;
}

interface RetainedLine {
  text: string;
  time: LineTime;
}

const TIMESTAMP_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})(?:\s|$)/;

const isBefore = (a: LineTime, b: LineTime): boolean =>
  a.epochMs !== b.epochMs ? a.epochMs < b.epochMs : a.nanos < b.nanos;

/**
 * State of one of the two streams. Each stream is filtered on its own and the two results are
 * merged by timestamp at the end : the last `tail` lines of the merged result are necessarily among
 * the last `tail` lines of each stream, so keeping `tail` lines per stream is enough.
 */
class StreamFilterState {
  /** Lines kept as pre context of a match that has not been seen yet. */
  private readonly pendingContext: RetainedLine[] = [];
  /** How many lines are still to be kept as post context of the last match. */
  private postContextLeft = 0;
  private readonly retained: RetainedLine[] = [];
  /**
   * Time of the last timestamped line of this stream. A line without a parsable timestamp (a stack
   * trace continuation written without one) inherits it, so it never jumps out of order.
   */
  private lastTime: LineTime = { epochMs: 0, nanos: 0 };

  public droppedByTail = false;

  constructor(
    private readonly tail: number,
    private readonly contextLines: number
  ) {}

  public add(text: string, matched: boolean, timestamp: LineTimestamp | null): void {
    if (timestamp !== null) this.lastTime = timestamp.time;
    const entry: RetainedLine = { text, time: this.lastTime };

    if (matched) {
      for (const context of this.pendingContext) this.keep(context);
      this.pendingContext.length = 0;
      this.keep(entry);
      this.postContextLeft = this.contextLines;
      return;
    }

    if (this.postContextLeft > 0) {
      this.postContextLeft--;
      this.keep(entry);
      return;
    }

    if (this.contextLines > 0) {
      this.pendingContext.push(entry);
      if (this.pendingContext.length > this.contextLines) this.pendingContext.shift();
    }
  }

  public getRetained(): RetainedLine[] {
    return this.retained;
  }

  private keep(entry: RetainedLine): void {
    this.retained.push(entry);
    if (this.retained.length > this.tail) {
      this.retained.shift();
      this.droppedByTail = true;
    }
  }
}

/** Reads the `--timestamps` prefix of a line, once, on the hot path of every line of the log. */
function parseTimestamp(text: string): LineTimestamp | null {
  const match = TIMESTAMP_REGEX.exec(text);
  if (match === null) return null;

  const [, dateTime, fraction, zone] = match;
  const nanos = fraction === undefined ? 0 : parseInt(fraction.padEnd(9, '0'), 10);
  const epochMs = Date.parse(`${dateTime}.${String(Math.floor(nanos / 1e6)).padStart(3, '0')}${zone}`);
  if (isNaN(epochMs)) return null;

  return {
    raw: `${dateTime}${fraction === undefined ? '' : `.${fraction}`}${zone}`,
    time: { epochMs, nanos },
  };
}

export class LogSearchFilter {
  private readonly states: Record<LogStream, StreamFilterState>;
  private readonly matcher: (line: string) => boolean;
  private readonly deadline: number;
  private readonly now: () => number;

  private totalLines = 0;
  private matchedLines = 0;
  private windowFrom: LineTimestamp | null = null;
  private windowTo: LineTimestamp | null = null;
  private timedOut = false;

  constructor(
    private readonly params: LogSearchQueryParams,
    options: LogSearchFilterOptions = {}
  ) {
    this.now = options.now ?? Date.now;
    this.deadline = this.now() + (options.timeoutMs ?? LOG_SEARCH_TIMEOUT_MS);
    this.matcher = buildMatcher(params);
    this.states = {
      stdout: new StreamFilterState(params.tail, params.contextLines),
      stderr: new StreamFilterState(params.tail, params.contextLines),
    };
  }

  /**
   * Feed one raw line of `docker logs --timestamps`.
   * @returns false once the deadline is passed, which tells the caller to stop reading.
   */
  public push(text: string, stream: LogStream): boolean {
    if (this.timedOut) return false;
    // The deadline is checked line by line : the regex engine never gives control back in the
    // middle of a line, so between two lines is the only moment where giving up is possible.
    if (this.now() >= this.deadline) {
      this.timedOut = true;
      return false;
    }

    this.totalLines++;
    const timestamp = parseTimestamp(text);
    if (timestamp !== null) this.trackWindow(timestamp);

    // step 2 : stderr only
    if (this.params.errorsOnly && stream !== 'stderr') return true;

    // step 3 : pattern and its context
    const matched = this.matcher(text);
    if (matched) this.matchedLines++;
    this.states[stream].add(text, matched, timestamp);

    return true;
  }

  /** Signals a timeout raised outside of the filter, when reading `docker logs` itself was cut. */
  public markTimedOut(): void {
    this.timedOut = true;
  }

  public isTimedOut(): boolean {
    return this.timedOut;
  }

  public buildResult(): LogSearchResult {
    const merged = mergeByTime(this.states.stdout.getRetained(), this.states.stderr.getRetained());

    // step 4 : the last `tail` lines of the filtered set
    const cutByTail =
      this.states.stdout.droppedByTail ||
      this.states.stderr.droppedByTail ||
      merged.length > this.params.tail;
    const tailed = merged.length > this.params.tail ? merged.slice(-this.params.tail) : merged;

    // step 5 : the byte ceiling, whole lines preserved
    const {
      logs,
      lineCount,
      truncated: cutByMaxBytes,
    } = truncateToMaxBytes(
      tailed.map((entry) => entry.text),
      this.params.maxBytes
    );

    let truncatedBy: LogSearchTruncationReason | undefined;
    if (cutByTail) truncatedBy = 'tail';
    if (cutByMaxBytes) truncatedBy = 'maxBytes';
    // A timeout means lines were never even read, which is the ceiling the caller must know about
    // first, so it wins over the other two.
    if (this.timedOut) truncatedBy = 'timeout';

    return {
      logs,
      returnedLines: lineCount,
      matchedLines: this.matchedLines,
      totalLines: this.totalLines,
      truncated: truncatedBy !== undefined,
      truncatedBy,
      window: { from: this.windowFrom?.raw ?? null, to: this.windowTo?.raw ?? null },
    };
  }

  /**
   * The range covered is the earliest and the latest timestamp read, and not the first and the last
   * line pushed : stdout and stderr are two pipes, whose chunks do not arrive in chronological
   * order.
   */
  private trackWindow(timestamp: LineTimestamp): void {
    if (this.windowFrom === null || isBefore(timestamp.time, this.windowFrom.time)) {
      this.windowFrom = timestamp;
    }
    if (this.windowTo === null || isBefore(this.windowTo.time, timestamp.time)) {
      this.windowTo = timestamp;
    }
  }
}

function buildMatcher(params: LogSearchQueryParams): (line: string) => boolean {
  const pattern = params.pattern;
  if (pattern === undefined) return () => true;

  if (params.patternMode === 'regex') {
    // no global flag : `test` would then carry a lastIndex from one line to the next
    const regex = new RegExp(pattern, params.caseSensitive ? '' : 'i');
    return (line) => regex.test(line);
  }

  if (params.caseSensitive) return (line) => line.includes(pattern);

  const lowered = pattern.toLowerCase();
  return (line) => line.toLowerCase().includes(lowered);
}

function mergeByTime(left: RetainedLine[], right: RetainedLine[]): RetainedLine[] {
  if (left.length === 0) return right;
  if (right.length === 0) return left;

  const merged: RetainedLine[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    // on an equal timestamp, stdout first : the order is then stable
    if (!isBefore(right[rightIndex].time, left[leftIndex].time)) {
      merged.push(left[leftIndex++]);
    } else {
      merged.push(right[rightIndex++]);
    }
  }

  while (leftIndex < left.length) merged.push(left[leftIndex++]);
  while (rightIndex < right.length) merged.push(right[rightIndex++]);

  return merged;
}

/**
 * Keeps the end of the lines, which is where the useful part of a log is, and drops whole lines
 * from the start until the result fits. A single line larger than the ceiling is cut rather than
 * dropped, so a match never comes back as an empty response.
 */
function truncateToMaxBytes(
  lines: string[],
  maxBytes: number
): { logs: string; lineCount: number; truncated: boolean } {
  if (lines.length === 0) return { logs: '', lineCount: 0, truncated: false };

  let firstKept = lines.length;
  let bytes = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    // + 1 for the newline joining this line to the next one
    const size = Buffer.byteLength(lines[i]) + (firstKept < lines.length ? 1 : 0);
    if (bytes + size > maxBytes) break;
    bytes += size;
    firstKept = i;
  }

  if (firstKept === lines.length) {
    // even the last line alone does not fit : it is cut, on a character boundary so that the
    // response never ends with half of a multi byte character
    const decoder = new StringDecoder('utf8');
    const lastLine = Buffer.from(lines[lines.length - 1]).subarray(0, maxBytes);
    return { logs: decoder.write(lastLine), lineCount: 1, truncated: true };
  }

  const kept = lines.slice(firstKept);
  return { logs: kept.join('\n'), lineCount: kept.length, truncated: firstKept > 0 };
}
