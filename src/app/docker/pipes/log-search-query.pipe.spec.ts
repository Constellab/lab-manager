import { BadRequestException } from '@nestjs/common';
import { LogSearchQueryPipe } from './log-search-query.pipe';

describe('LogSearchQueryPipe', () => {
  const pipe = new LogSearchQueryPipe();

  it('should validate and default the query string', () => {
    expect(pipe.transform({ pattern: 'BOOM', tail: '50' })).toEqual({
      tail: 50,
      since: undefined,
      until: undefined,
      pattern: 'BOOM',
      patternMode: 'substring',
      caseSensitive: false,
      contextLines: 0,
      errorsOnly: false,
      maxBytes: 262144,
    });
  });

  it('should reject an unknown parameter rather than silently ignore it', () => {
    // ignoring it would let the caller believe its filter was applied
    expect(() => pipe.transform({ tial: '50' })).toThrow(BadRequestException);
  });
});
