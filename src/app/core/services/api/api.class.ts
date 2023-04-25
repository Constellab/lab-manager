import {AxiosError, AxiosRequestConfig} from 'axios';

export type ApiHttpOptionObserve = 'data' | 'response';

export interface ApiHttpOption extends AxiosRequestConfig {

  /**
   * If response, the whole AxiosResponse is return and no conversion is made
   * If data, it only returns the content of the response
   */
  observe?: ApiHttpOptionObserve;

  /**
   * Log error in the console if true
   * Default is true
   */
  logError?: boolean;
}

export interface ApiError{
  status: number;
  message: string;
  error: AxiosError;
  knownError?: KnowApiError;
}

/**
 * Format of the nest response error
 */
export interface KnowApiError {
  // http status
  status: number;

  // unique error code
  code: string;

  // unique id of this error instance
  detail?: string;

  // unique id of this error instance
  instanceId: string;
}
