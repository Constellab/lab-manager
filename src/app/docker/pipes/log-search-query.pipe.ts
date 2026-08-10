import { Injectable, PipeTransform } from '@nestjs/common';
import { parseLogSearchQuery } from '../container/log-search-params';
import { LogSearchQueryParams } from '../container/log-search.dto';

/**
 * Validates the query string of the log search route, and rejects anything it does not know.
 */
@Injectable()
export class LogSearchQueryPipe implements PipeTransform<Record<string, unknown>, LogSearchQueryParams> {
  transform(value: Record<string, unknown>): LogSearchQueryParams {
    return parseLogSearchQuery(value ?? {});
  }
}
