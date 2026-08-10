import { BadRequestException } from '@nestjs/common';
import { parseLogSearchQuery } from './log-search-params';

/**
 * The error bodies of this endpoint are read by a model, so every test below asserts
 * on the content of the message and not only on the status code.
 */
describe('parseLogSearchQuery', () => {
  const messageOf = (query: Record<string, unknown>): string => {
    try {
      parseLogSearchQuery(query);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const response = (e as BadRequestException).getResponse() as { message: string };
      return response.message;
    }
    throw new Error('Expected parseLogSearchQuery to throw');
  };

  describe('defaults', () => {
    it('should apply the documented defaults when no parameter is provided', () => {
      expect(parseLogSearchQuery({})).toEqual({
        tail: 200,
        since: undefined,
        until: undefined,
        pattern: undefined,
        patternMode: 'substring',
        caseSensitive: false,
        contextLines: 0,
        errorsOnly: false,
        maxBytes: 262144,
      });
    });
  });

  describe('unknown parameters', () => {
    it('should reject an unknown parameter instead of ignoring it', () => {
      const message = messageOf({ taill: '10' });
      expect(message).toContain(`'taill'`);
      expect(message).toContain('tail');
      expect(message).toContain('patternMode');
    });

    it('should reject a parameter provided several times', () => {
      expect(messageOf({ tail: ['10', '20'] })).toContain(`'tail'`);
    });
  });

  describe('integer parameters', () => {
    it('should parse tail, contextLines and maxBytes', () => {
      const params = parseLogSearchQuery({ tail: '50', contextLines: '3', maxBytes: '1024' });
      expect(params.tail).toBe(50);
      expect(params.contextLines).toBe(3);
      expect(params.maxBytes).toBe(1024);
    });

    it('should reject a non integer value naming the parameter', () => {
      const message = messageOf({ tail: 'abc' });
      expect(message).toContain(`'tail'`);
      expect(message).toContain('abc');
      expect(message).toContain('2000');
    });

    it('should reject a value above the cap, reporting the value and the cap', () => {
      const message = messageOf({ tail: '5000' });
      expect(message).toContain('5000');
      expect(message).toContain('2000');
    });

    it('should reject contextLines above 20 and maxBytes above 1048576', () => {
      expect(messageOf({ contextLines: '21' })).toContain('20');
      expect(messageOf({ maxBytes: '1048577' })).toContain('1048576');
    });

    it('should reject a value below the minimum', () => {
      expect(messageOf({ tail: '0' })).toContain(`'tail'`);
      expect(parseLogSearchQuery({ contextLines: '0' }).contextLines).toBe(0);
    });
  });

  describe('boolean parameters', () => {
    it('should parse true and false', () => {
      expect(parseLogSearchQuery({ errorsOnly: 'true' }).errorsOnly).toBe(true);
      expect(parseLogSearchQuery({ caseSensitive: 'TRUE' }).caseSensitive).toBe(true);
      expect(parseLogSearchQuery({ errorsOnly: 'false' }).errorsOnly).toBe(false);
    });

    it('should reject a non boolean value listing the accepted values', () => {
      const message = messageOf({ errorsOnly: 'yes' });
      expect(message).toContain(`'errorsOnly'`);
      expect(message).toContain('true');
      expect(message).toContain('false');
    });
  });

  describe('pattern', () => {
    it('should default to the substring mode', () => {
      expect(parseLogSearchQuery({ pattern: 'a(' }).patternMode).toBe('substring');
    });

    it('should accept an explicit regex mode', () => {
      expect(parseLogSearchQuery({ pattern: 'a+', patternMode: 'regex' }).patternMode).toBe('regex');
    });

    it('should reject an unknown pattern mode', () => {
      const message = messageOf({ patternMode: 'glob' });
      expect(message).toContain('glob');
      expect(message).toContain('substring');
      expect(message).toContain('regex');
    });

    it('should reject a pattern longer than 200 characters', () => {
      const message = messageOf({ pattern: 'a'.repeat(201) });
      expect(message).toContain('201');
      expect(message).toContain('200');
    });

    it('should reject an invalid regex, naming the accepted flavour', () => {
      const message = messageOf({ pattern: 'a(', patternMode: 'regex' });
      expect(message).toContain(`'pattern'`);
      expect(message.toLowerCase()).toContain('regexp');
    });

    it('should not compile the pattern in substring mode', () => {
      expect(parseLogSearchQuery({ pattern: 'a(' }).pattern).toBe('a(');
    });

    describe('catastrophic backtracking', () => {
      // A single RegExp.test call blocks the event loop until the engine is done, so the timeout of
      // the filtering step cannot save a lab from these : they are refused before they run.
      it.each(['(a+)+$', '(a*)*b', '([a-z]+)*', '(\\s+)+$', '(a|b)+', '(a+){2,}'])(
        'should reject %s',
        (pattern) => {
          const message = messageOf({ pattern, patternMode: 'regex' });
          expect(message).toContain(`'pattern'`);
          expect(message).toContain('exponential');
          expect(message).toContain('substring');
        }
      );

      it.each([
        'ERROR|FATAL',
        '(ERROR|FATAL)?',
        'Traceback.*',
        '[a-z]+\\d{2,4}',
        '(?:GET|POST) /api',
        // a bounded repetition stays allowed : an IPv4 address is a legitimate thing to look for
        '(\\d+\\.){3}\\d+',
      ])('should accept the reasonable pattern %s', (pattern) => {
        expect(parseLogSearchQuery({ pattern, patternMode: 'regex' }).pattern).toBe(pattern);
      });

      it('should not inspect the pattern in substring mode, where no engine runs', () => {
        expect(parseLogSearchQuery({ pattern: '(a+)+$' }).pattern).toBe('(a+)+$');
      });
    });
  });

  describe('since and until', () => {
    it('should accept a relative duration', () => {
      expect(parseLogSearchQuery({ since: '30m' }).since).toBe('30m');
      expect(parseLogSearchQuery({ until: '2h' }).until).toBe('2h');
    });

    it('should convert days to hours because docker durations have no day unit', () => {
      expect(parseLogSearchQuery({ since: '1d' }).since).toBe('24h');
      expect(parseLogSearchQuery({ since: '2d12h' }).since).toBe('60h');
    });

    it('should accept an RFC 3339 timestamp', () => {
      expect(parseLogSearchQuery({ since: '2026-08-10T08:42:00Z' }).since).toBe('2026-08-10T08:42:00Z');
    });

    it('should reject an unparsable value listing the accepted formats', () => {
      const message = messageOf({ since: 'yesterday' });
      expect(message).toContain(`'since'`);
      expect(message).toContain('yesterday');
      expect(message).toContain('30m');
      expect(message).toContain('RFC 3339');
    });

    it('should reject a timestamp that looks valid but is not a real date', () => {
      expect(messageOf({ until: '2026-13-45T08:42:00Z' })).toContain(`'until'`);
    });
  });
});
