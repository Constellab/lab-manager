import { BadRequestException } from '@nestjs/common';
import {
  LOG_SEARCH_DEFAULT_MAX_BYTES,
  LOG_SEARCH_DEFAULT_TAIL,
  LOG_SEARCH_MAX_CONTEXT_LINES,
  LOG_SEARCH_MAX_MAX_BYTES,
  LOG_SEARCH_MAX_PATTERN_LENGTH,
  LOG_SEARCH_MAX_TAIL,
  LOG_SEARCH_PARAMETERS,
  LOG_SEARCH_REGEX_FLAVOUR,
  LogSearchPatternMode,
  LogSearchQueryParams,
} from './log-search.dto';

/**
 * Validation of the query parameters of the log search route.
 *
 * Every message is written to be actionable by a model : it names the offending parameter, the
 * value received and the accepted values, so that the caller does not have to guess on a retry.
 * Unknown parameters are rejected rather than ignored, which is what allows parameters to be added
 * later without an older caller believing they were applied.
 */

const ACCEPTED_PARAMETERS = LOG_SEARCH_PARAMETERS.join(', ');

const RELATIVE_DURATION_REGEX = /^(\d+[smhd])+$/;
const DURATION_PART_REGEX = /(\d+)([smhd])/g;
const RFC_3339_REGEX = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

const TIME_FORMATS_HELP =
  `a relative duration such as '30m', '2h' or '1d' (units s, m, h, d), ` +
  `or an RFC 3339 timestamp such as '2026-08-10T09:12:04Z'`;

function fail(message: string): never {
  throw new BadRequestException(message);
}

/** Query values arrive as strings, or as arrays when a parameter is repeated. */
function readRaw(query: Record<string, unknown>, name: string): string | undefined {
  const value = query[name];
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    fail(`Parameter '${name}' was provided ${value.length} times, it accepts a single value.`);
  }
  return String(value);
}

function rejectUnknownParameters(query: Record<string, unknown>): void {
  const accepted: readonly string[] = LOG_SEARCH_PARAMETERS;
  for (const name of Object.keys(query)) {
    if (!accepted.includes(name)) {
      fail(`Unknown query parameter '${name}'. Accepted parameters: ${ACCEPTED_PARAMETERS}.`);
    }
  }
}

function parseIntegerParam(
  query: Record<string, unknown>,
  name: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  const raw = readRaw(query, name);
  if (raw === undefined) return defaultValue;

  if (!/^-?\d+$/.test(raw)) {
    fail(
      `Parameter '${name}' must be an integer, received '${raw}'. ` +
        `Accepted values: integers from ${min} to ${max} (default ${defaultValue}).`
    );
  }

  const value = parseInt(raw, 10);
  if (value > max) {
    fail(`Parameter '${name}' received ${value} but the maximum accepted value is ${max}.`);
  }
  if (value < min) {
    fail(`Parameter '${name}' received ${value} but the minimum accepted value is ${min}.`);
  }
  return value;
}

function parseBooleanParam(query: Record<string, unknown>, name: string, defaultValue: boolean): boolean {
  const raw = readRaw(query, name);
  if (raw === undefined) return defaultValue;

  const normalized = raw.toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  fail(`Parameter '${name}' must be a boolean, received '${raw}'. Accepted values: true, false.`);
}

function parsePatternMode(query: Record<string, unknown>): LogSearchPatternMode {
  const raw = readRaw(query, 'patternMode');
  if (raw === undefined) return 'substring';
  if (raw === 'substring' || raw === 'regex') return raw;

  fail(`Parameter 'patternMode' received '${raw}'. Accepted values: substring, regex (default substring).`);
}

function parsePattern(query: Record<string, unknown>, mode: LogSearchPatternMode): string | undefined {
  const raw = readRaw(query, 'pattern');
  if (raw === undefined) return undefined;

  // A pattern comes from a model and runs against a log that can weigh hundreds of megabytes,
  // so its length is capped before it ever reaches the regex engine.
  if (raw.length > LOG_SEARCH_MAX_PATTERN_LENGTH) {
    fail(
      `Parameter 'pattern' received ${raw.length} characters but the maximum accepted length is ` +
        `${LOG_SEARCH_MAX_PATTERN_LENGTH} characters.`
    );
  }

  if (mode === 'regex') {
    try {
      new RegExp(raw);
    } catch (e) {
      fail(
        `Parameter 'pattern' is not a valid regular expression: ${(e as Error).message}. ` +
          `Accepted flavour: ${LOG_SEARCH_REGEX_FLAVOUR}.`
      );
    }
    assertPatternCannotBacktrackCatastrophically(raw);
  }

  return raw;
}

/**
 * Rejects the patterns whose matching time is exponential in the length of the line.
 *
 * The timeout of the filtering step is checked between two lines, because that is the only moment
 * where control comes back to us : `RegExp.test` is a single call that blocks the event loop until
 * the engine is done, and no timer can interrupt it. `(a+)+$` on a thirty character line already
 * runs for minutes. The JavaScript engine not being linear time, the only protection left against a
 * pattern written by a model is to refuse this family before it runs.
 *
 * The rule targets that family only : an **unbounded** repetition applied to a group that itself
 * repeats without bound or alternates. `ERROR|FATAL`, `(ERROR|FATAL)?` and `(\d+\.){3}\d+` pass,
 * `(a+)+`, `([0-9a-f]+:)+` and `(a|b)*` do not, and the message says how to rewrite them. A bounded
 * repetition such as `{3}` stays allowed : its cost grows as a polynomial of a fixed small degree,
 * where the nesting above grows as a power of the length of the line.
 */
function assertPatternCannotBacktrackCatastrophically(pattern: string): void {
  interface GroupFlags {
    hasUnboundedRepetition: boolean;
    hasAlternation: boolean;
  }

  const stack: GroupFlags[] = [{ hasUnboundedRepetition: false, hasAlternation: false }];
  let inCharacterClass = false;

  const rejectNesting = (): never =>
    fail(
      `Parameter 'pattern' received '${pattern}', which applies an unbounded repetition (*, + or ` +
        `{n,}) to a group that already repeats or alternates. Matching it can take an exponential ` +
        `time and would freeze the lab, so it is refused. Rewrite it without nesting the ` +
        `repetitions, for example 'a+' instead of '(a+)+', or use patternMode=substring.`
    );

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === '\\') {
      i++;
      continue;
    }
    if (inCharacterClass) {
      if (char === ']') inCharacterClass = false;
      continue;
    }

    switch (char) {
      case '[':
        inCharacterClass = true;
        break;
      case '|':
        stack[stack.length - 1].hasAlternation = true;
        break;
      case '(':
        stack.push({ hasUnboundedRepetition: false, hasAlternation: false });
        break;
      case ')': {
        const group = stack.pop();
        if (group === undefined) return; // unbalanced, the RegExp constructor already rejected it
        const repetition = readRepetition(pattern, i + 1);
        const parent = stack[stack.length - 1];

        if (repetition.unbounded && (group.hasUnboundedRepetition || group.hasAlternation)) {
          rejectNesting();
        }

        parent.hasUnboundedRepetition =
          parent.hasUnboundedRepetition || group.hasUnboundedRepetition || repetition.unbounded;
        parent.hasAlternation = parent.hasAlternation || group.hasAlternation;
        i += repetition.length;
        break;
      }
      case '*':
      case '+':
        stack[stack.length - 1].hasUnboundedRepetition = true;
        break;
      case '{': {
        const repetition = readRepetition(pattern, i);
        if (repetition.unbounded) stack[stack.length - 1].hasUnboundedRepetition = true;
        i += Math.max(repetition.length - 1, 0);
        break;
      }
    }
  }
}

/**
 * Reads the repetition operator starting at `index`.
 * `unbounded` is the only thing that matters here : `*`, `+` and `{n,}` are the operators that can
 * try an unbounded number of ways to match, `?` and `{n,m}` cannot.
 */
function readRepetition(pattern: string, index: number): { unbounded: boolean; length: number } {
  const char = pattern[index];
  if (char === '*' || char === '+') return { unbounded: true, length: 1 };
  if (char === '?') return { unbounded: false, length: 1 };

  if (char === '{') {
    const end = pattern.indexOf('}', index);
    if (end === -1) return { unbounded: false, length: 0 };
    const body = pattern.slice(index + 1, end);
    if (!/^\d+(,\d*)?$/.test(body)) return { unbounded: false, length: 0 };
    const parts = body.split(',');
    return { unbounded: parts.length === 2 && parts[1] === '', length: end - index + 1 };
  }

  return { unbounded: false, length: 0 };
}

/**
 * `docker logs --since/--until` accepts a Go duration or an RFC 3339 timestamp. Go durations have
 * no day unit, so `1d` is converted to `24h` rather than handed over as is.
 */
function parseTimeParam(query: Record<string, unknown>, name: string): string | undefined {
  const raw = readRaw(query, name);
  if (raw === undefined) return undefined;

  if (RELATIVE_DURATION_REGEX.test(raw)) {
    return normalizeDuration(raw);
  }

  if (RFC_3339_REGEX.test(raw) && !isNaN(Date.parse(raw))) {
    return raw;
  }

  fail(`Parameter '${name}' received '${raw}'. Accepted formats: ${TIME_FORMATS_HELP}.`);
}

function normalizeDuration(duration: string): string {
  let seconds = 0;
  let minutes = 0;
  let hours = 0;

  DURATION_PART_REGEX.lastIndex = 0;
  let part = DURATION_PART_REGEX.exec(duration);
  while (part !== null) {
    const value = parseInt(part[1], 10);
    switch (part[2]) {
      case 's':
        seconds += value;
        break;
      case 'm':
        minutes += value;
        break;
      case 'h':
        hours += value;
        break;
      case 'd':
        hours += value * 24;
        break;
    }
    part = DURATION_PART_REGEX.exec(duration);
  }

  const normalized = `${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? `${minutes}m` : ''}${
    seconds > 0 ? `${seconds}s` : ''
  }`;
  return normalized === '' ? '0s' : normalized;
}

export function parseLogSearchQuery(query: Record<string, unknown>): LogSearchQueryParams {
  rejectUnknownParameters(query);

  const patternMode = parsePatternMode(query);

  return {
    tail: parseIntegerParam(query, 'tail', LOG_SEARCH_DEFAULT_TAIL, 1, LOG_SEARCH_MAX_TAIL),
    since: parseTimeParam(query, 'since'),
    until: parseTimeParam(query, 'until'),
    pattern: parsePattern(query, patternMode),
    patternMode,
    caseSensitive: parseBooleanParam(query, 'caseSensitive', false),
    contextLines: parseIntegerParam(query, 'contextLines', 0, 0, LOG_SEARCH_MAX_CONTEXT_LINES),
    errorsOnly: parseBooleanParam(query, 'errorsOnly', false),
    maxBytes: parseIntegerParam(query, 'maxBytes', LOG_SEARCH_DEFAULT_MAX_BYTES, 1, LOG_SEARCH_MAX_MAX_BYTES),
  };
}
