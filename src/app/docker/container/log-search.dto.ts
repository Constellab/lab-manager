/**
 * Contract of `GET /docker-containers/:containerName/logs/search`.
 *
 * This route exists so that a machine client (the Space API MCP server) can diagnose a lab
 * without transferring the whole log blob off the lab. It is a route of its own rather than
 * query parameters on `/logs` so that an older lab manager answers 404 instead of silently
 * ignoring the parameters and returning everything.
 */

export type LogSearchPatternMode = 'substring' | 'regex';

/** Which ceiling cut the response short. Absent when nothing was cut. */
export type LogSearchTruncationReason = 'tail' | 'maxBytes' | 'timeout';

/** Query parameters of the route, once validated and defaulted. */
export interface LogSearchQueryParams {
  /** Number of lines returned, taken from the end of the filtered set. */
  tail: number;
  /** Lower bound of the time window, ready to be passed to `docker logs --since`. */
  since?: string;
  /** Upper bound of the time window, ready to be passed to `docker logs --until`. */
  until?: string;
  /** Line level filter. */
  pattern?: string;
  patternMode: LogSearchPatternMode;
  /** Applies to both pattern modes. */
  caseSensitive: boolean;
  /** Lines kept either side of each matching line. */
  contextLines: number;
  /** Restrict to stderr, equivalent to the `/logs/error` route. */
  errorsOnly: boolean;
  /** Size ceiling of the `logs` field, whole lines preserved. */
  maxBytes: number;
}

/** Time range actually covered by the lines that were read, null when nothing was read. */
export interface LogSearchWindow {
  from: string | null;
  to: string | null;
}

export interface LogSearchResult {
  /** Same name and type as the field of `/logs`, so a consumer reading only this keeps working. */
  logs: string;
  /** Number of lines in `logs`. */
  returnedLines: number;
  /**
   * Lines matching `pattern` before `tail` is applied. Greater than `returnedLines` means the
   * pattern is too broad.
   */
  matchedLines: number;
  /** Lines read in the time window, before any filtering. Tells the caller it has not seen everything. */
  totalLines: number;
  truncated: boolean;
  /** Which ceiling bit, so the caller knows which parameter to adjust. */
  truncatedBy?: LogSearchTruncationReason;
  window: LogSearchWindow;
}

export const LOG_SEARCH_DEFAULT_TAIL = 200;
export const LOG_SEARCH_MAX_TAIL = 2000;
export const LOG_SEARCH_MAX_PATTERN_LENGTH = 200;
export const LOG_SEARCH_MAX_CONTEXT_LINES = 20;
export const LOG_SEARCH_DEFAULT_MAX_BYTES = 262144;
export const LOG_SEARCH_MAX_MAX_BYTES = 1048576;

/**
 * Hard ceiling on the reading and filtering step. Past it the response is a 200 carrying what was
 * collected, because a partial diagnosis beats an error.
 */
export const LOG_SEARCH_TIMEOUT_MS = 2000;

/** Named in the 400 body so a model writing PCRE understands why its pattern was rejected. */
export const LOG_SEARCH_REGEX_FLAVOUR =
  'JavaScript (ECMAScript) RegExp, as accepted by the RegExp constructor';

/** The exhaustive list of accepted query parameters, anything else is a 400. */
export const LOG_SEARCH_PARAMETERS = [
  'tail',
  'since',
  'until',
  'pattern',
  'patternMode',
  'caseSensitive',
  'contextLines',
  'errorsOnly',
  'maxBytes',
] as const;
