import { LogSearchFilter } from './log-search-filter';
import { LogSearchQueryParams } from './log-search.dto';
import { parseLogSearchQuery } from './log-search-params';

/** Timestamp of the second `second` of 2026-08-10T09:00, in the format `docker logs --timestamps` emits. */
const at = (second: number): string => `2026-08-10T09:00:${String(second).padStart(2, '0')}.000000000Z`;

/** A raw docker log line, timestamp included. */
const line = (second: number, message: string): string => `${at(second)} ${message}`;

const paramsOf = (overrides: Partial<LogSearchQueryParams> = {}): LogSearchQueryParams => ({
  ...parseLogSearchQuery({}),
  ...overrides,
});

describe('LogSearchFilter', () => {
  describe('without any filter', () => {
    it('should return every line and count them', () => {
      const filter = new LogSearchFilter(paramsOf());
      filter.push(line(1, 'one'), 'stdout');
      filter.push(line(2, 'two'), 'stdout');

      const result = filter.buildResult();

      expect(result.logs).toBe(`${line(1, 'one')}\n${line(2, 'two')}`);
      expect(result.totalLines).toBe(2);
      expect(result.matchedLines).toBe(2);
      expect(result.returnedLines).toBe(2);
      expect(result.truncated).toBe(false);
      expect(result.truncatedBy).toBeUndefined();
    });

    it('should report an empty result on a container with no logs', () => {
      const result = new LogSearchFilter(paramsOf()).buildResult();

      expect(result.logs).toBe('');
      expect(result.totalLines).toBe(0);
      expect(result.matchedLines).toBe(0);
      expect(result.returnedLines).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.window).toEqual({ from: null, to: null });
    });
  });

  describe('order of operations', () => {
    // The whole point of the endpoint: `docker logs --tail 10 | grep BOOM` returns nothing here,
    // the documented order returns the answer.
    it('should keep a match that lies outside the last `tail` lines of the raw log', () => {
      const filter = new LogSearchFilter(paramsOf({ tail: 10, pattern: 'BOOM' }));
      filter.push(line(0, 'BOOM the interesting line'), 'stdout');
      for (let i = 1; i <= 60; i++) {
        filter.push(line(i, `noise ${i}`), 'stdout');
      }

      const result = filter.buildResult();

      expect(result.logs).toBe(line(0, 'BOOM the interesting line'));
      expect(result.returnedLines).toBe(1);
      expect(result.matchedLines).toBe(1);
      expect(result.totalLines).toBe(61);
      expect(result.truncated).toBe(false);
    });

    it('should apply tail to the filtered set, not to the raw log', () => {
      const filter = new LogSearchFilter(paramsOf({ tail: 2, pattern: 'BOOM' }));
      for (let i = 0; i < 10; i++) {
        filter.push(line(i, i % 2 === 0 ? `BOOM ${i}` : `noise ${i}`), 'stdout');
      }

      const result = filter.buildResult();

      expect(result.logs).toBe(`${line(6, 'BOOM 6')}\n${line(8, 'BOOM 8')}`);
      expect(result.matchedLines).toBe(5);
      expect(result.returnedLines).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.truncatedBy).toBe('tail');
    });
  });

  describe('pattern', () => {
    it('should match a substring case insensitively by default', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'traceback' }));
      filter.push(line(1, 'Traceback (most recent call last):'), 'stdout');
      filter.push(line(2, 'all good'), 'stdout');

      expect(filter.buildResult().returnedLines).toBe(1);
    });

    it('should honour caseSensitive in substring mode', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'traceback', caseSensitive: true }));
      filter.push(line(1, 'Traceback (most recent call last):'), 'stdout');

      expect(filter.buildResult().returnedLines).toBe(0);
    });

    it('should treat the pattern literally in substring mode', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'a.c' }));
      filter.push(line(1, 'abc'), 'stdout');
      filter.push(line(2, 'a.c'), 'stdout');

      expect(filter.buildResult().logs).toBe(line(2, 'a.c'));
    });

    it('should match a regex when the mode is explicitly requested', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'ERROR|FATAL', patternMode: 'regex' }));
      filter.push(line(1, 'FATAL boom'), 'stdout');
      filter.push(line(2, 'info'), 'stdout');

      expect(filter.buildResult().logs).toBe(line(1, 'FATAL boom'));
    });

    it('should honour caseSensitive in regex mode', () => {
      const filter = new LogSearchFilter(
        paramsOf({ pattern: 'error', patternMode: 'regex', caseSensitive: true })
      );
      filter.push(line(1, 'ERROR boom'), 'stdout');

      expect(filter.buildResult().returnedLines).toBe(0);
    });
  });

  describe('contextLines', () => {
    it('should keep the lines around each match without duplicating them', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'BOOM', contextLines: 1 }));
      filter.push(line(1, 'before'), 'stdout');
      filter.push(line(2, 'BOOM'), 'stdout');
      filter.push(line(3, 'after'), 'stdout');
      filter.push(line(4, 'far away'), 'stdout');

      const result = filter.buildResult();

      expect(result.logs).toBe([line(1, 'before'), line(2, 'BOOM'), line(3, 'after')].join('\n'));
      // matchedLines counts the matches themselves, the context is extra
      expect(result.matchedLines).toBe(1);
      expect(result.returnedLines).toBe(3);
    });

    it('should not duplicate a line that is both context and a match', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'BOOM', contextLines: 2 }));
      filter.push(line(1, 'BOOM one'), 'stdout');
      filter.push(line(2, 'BOOM two'), 'stdout');

      expect(filter.buildResult().returnedLines).toBe(2);
    });
  });

  describe('errorsOnly', () => {
    it('should restrict the result to stderr but still count every line of the window', () => {
      const filter = new LogSearchFilter(paramsOf({ errorsOnly: true }));
      filter.push(line(1, 'stdout line'), 'stdout');
      filter.push(line(2, 'stderr line'), 'stderr');

      const result = filter.buildResult();

      expect(result.logs).toBe(line(2, 'stderr line'));
      expect(result.returnedLines).toBe(1);
      expect(result.totalLines).toBe(2);
    });
  });

  describe('stream merging', () => {
    it('should interleave stdout and stderr by timestamp', () => {
      const filter = new LogSearchFilter(paramsOf());
      filter.push(line(1, 'out 1'), 'stdout');
      filter.push(line(3, 'out 3'), 'stdout');
      filter.push(line(2, 'err 2'), 'stderr');
      filter.push(line(4, 'err 4'), 'stderr');

      expect(filter.buildResult().logs).toBe(
        [line(1, 'out 1'), line(2, 'err 2'), line(3, 'out 3'), line(4, 'err 4')].join('\n')
      );
    });

    it('should keep a line without a parsable timestamp in the order of its stream', () => {
      const filter = new LogSearchFilter(paramsOf());
      filter.push(line(1, 'out 1'), 'stdout');
      filter.push('continuation without timestamp', 'stdout');
      filter.push(line(3, 'out 3'), 'stdout');

      expect(filter.buildResult().logs).toBe(
        [line(1, 'out 1'), 'continuation without timestamp', line(3, 'out 3')].join('\n')
      );
    });
  });

  describe('window', () => {
    it('should report the range actually covered, not the range returned', () => {
      const filter = new LogSearchFilter(paramsOf({ pattern: 'BOOM' }));
      filter.push(line(1, 'noise'), 'stdout');
      filter.push(line(5, 'BOOM'), 'stdout');
      filter.push(line(9, 'noise'), 'stderr');

      expect(filter.buildResult().window).toEqual({ from: at(1), to: at(9) });
    });

    it('should report the earliest and the latest line, whatever the order they arrive in', () => {
      // stdout and stderr are two pipes : their chunks do not arrive in chronological order
      const filter = new LogSearchFilter(paramsOf());
      filter.push(line(4, 'out 4'), 'stdout');
      filter.push(line(9, 'out 9'), 'stdout');
      filter.push(line(2, 'err 2'), 'stderr');
      filter.push(line(7, 'err 7'), 'stderr');

      expect(filter.buildResult().window).toEqual({ from: at(2), to: at(9) });
    });
  });

  describe('maxBytes', () => {
    it('should drop whole lines from the start and report the reason', () => {
      const filter = new LogSearchFilter(paramsOf({ maxBytes: 100 }));
      filter.push(line(1, 'a'.repeat(40)), 'stdout');
      filter.push(line(2, 'b'.repeat(40)), 'stdout');

      const result = filter.buildResult();

      expect(result.logs).toBe(line(2, 'b'.repeat(40)));
      expect(result.returnedLines).toBe(1);
      expect(result.matchedLines).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.truncatedBy).toBe('maxBytes');
    });

    it('should cut a single line that is larger than maxBytes rather than return nothing', () => {
      const filter = new LogSearchFilter(paramsOf({ maxBytes: 20 }));
      filter.push(line(1, 'a'.repeat(100)), 'stdout');

      const result = filter.buildResult();

      expect(Buffer.byteLength(result.logs)).toBeLessThanOrEqual(20);
      expect(result.returnedLines).toBe(1);
      expect(result.truncatedBy).toBe('maxBytes');
    });

    it('should count bytes and not characters', () => {
      const filter = new LogSearchFilter(paramsOf({ maxBytes: 40 }));
      // 'é' weighs two bytes in UTF-8
      filter.push(line(1, 'é'.repeat(10)), 'stdout');
      filter.push(line(2, 'ok'), 'stdout');

      expect(filter.buildResult().logs).toBe(line(2, 'ok'));
    });
  });

  describe('timeout', () => {
    it('should stop filtering past the deadline and report the timeout', () => {
      let now = 1_000;
      const filter = new LogSearchFilter(paramsOf(), { timeoutMs: 2_000, now: () => now });

      filter.push(line(1, 'collected'), 'stdout');
      now = 10_000;
      filter.push(line(2, 'never seen'), 'stdout');

      const result = filter.buildResult();

      expect(filter.isTimedOut()).toBe(true);
      expect(result.logs).toBe(line(1, 'collected'));
      expect(result.truncated).toBe(true);
      expect(result.truncatedBy).toBe('timeout');
      expect(result.returnedLines).toBe(1);
    });

    it('should report a timeout raised by the caller, and prefer it over the other reasons', () => {
      const filter = new LogSearchFilter(paramsOf({ tail: 1 }));
      filter.push(line(1, 'one'), 'stdout');
      filter.push(line(2, 'two'), 'stdout');
      filter.markTimedOut();

      const result = filter.buildResult();

      expect(result.truncated).toBe(true);
      expect(result.truncatedBy).toBe('timeout');
    });

    it('should stop a slow filtering mid log and answer with what it has', () => {
      // a regex that is slow only because the log is long : the deadline is reached between two
      // lines, which is the only moment where the engine gives control back
      let now = 0;
      const filter = new LogSearchFilter(paramsOf({ pattern: 'BOOM', patternMode: 'regex' }), {
        timeoutMs: 50,
        now: () => (now += 30),
      });

      for (let i = 0; i < 100; i++) {
        filter.push(line(i % 60, `BOOM ${i}`), 'stdout');
      }

      const result = filter.buildResult();

      expect(result.truncatedBy).toBe('timeout');
      expect(result.truncated).toBe(true);
      expect(result.totalLines).toBeLessThan(100);
      expect(result.totalLines).toBeGreaterThan(0);
    });
  });
});
