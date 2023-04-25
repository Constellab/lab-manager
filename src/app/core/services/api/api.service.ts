import {Injectable, Logger} from '@nestjs/common';
import {Observable, throwError} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {AxiosError, AxiosResponse} from 'axios';
import {HttpService} from '@nestjs/axios';
import { ApiError, ApiHttpOption, ApiHttpOptionObserve } from './api.class';

@Injectable()
export class ApiService {


  constructor(private httpService: HttpService) {
  }

  /**
   * HTTP POST. Call a post request.
   * @param route the route for the api call
   * @param body object to post
   * @param classReference if not null the response is converted to the classReference
   * @param options custom http options
   */
  public post(route: string, body: any,
              options: ApiHttpOption = {}): Observable<any> {
    return this.httpService.post(route, body, options as any).pipe(
      map(result => this.deserialize(result as any, options.observe)),
      catchError(err => this.catchError(err, route, options.logError)),
    );
  }

  /**
   * HTTP PUT. Call a put request
   * @param route the route for the api call
   * @param body object to update
   * @param classReference if not null the response is converted to the classReference
   * @param options custom http options
   */
  public put(route: string, body: any,
             options: ApiHttpOption = {}): Observable<any> {
    return this.httpService.put(route, body, options as any).pipe(
      map(result => this.deserialize(result as any, options.observe)),
      catchError(err => this.catchError(err, route, options.logError)),
    );
  }

  /**
   * HTTP DELETE. Call a delete request.
   * @param route the route for the api call
   * @param classReference if not null the response is converted to the classReference
   * @param options custom http options
   */
  public delete(route: string,
                options: ApiHttpOption = {}): Observable<any> {
    return this.httpService.delete(route, options as any).pipe(
      map(result => this.deserialize(result as any, options.observe)),
      catchError(err => this.catchError(err, route, options.logError)),
    );
  }

  /**
   * HTTP GET. Basic get request.
   * @param route the route for the api call
   * @param classReference if not null the response is converted to the classReference
   * @param options custom http options
   */
  public get(route: string,
             options: ApiHttpOption = {}): Observable<any> {
    return this.httpService.get(route, options as any).pipe(
      map(result => this.deserialize(result as any, options.observe)),
      catchError(err => this.catchError(err, route, options.logError)),
    );
  }

  /**
   * Make an http post with form data with the ip of the lab and the API key of the lab in header
   */
  public postFormData(route: string, formData: any,
                      options: ApiHttpOption = {}): Observable<any> {
    // add the formData header
    options.headers = Object.assign({}, options.headers, formData.getHeaders());

    return this.post(route, formData.getBuffer(), options).pipe(
      catchError(err => this.catchError(err, route, options.logError)),
    );
  }

  /**
   * Deserialize an object or array using json converter package if the input are not null
   * @param response
   * @param classReference class reference of object
   * @param observe
   * @param isPaginated if true the result is considered as a {@link ClPageI}
   */
  public deserialize(response: AxiosResponse,
                     observe: ApiHttpOptionObserve = 'data'): any {

    if (observe === 'response') {
      return response;
    }

    return response.data;
  }


  private catchError(error: AxiosError, route: string, logError?: boolean): Observable<never> {

    const apiError: ApiError = {
      status: error.response ? error.response.status : null,
      message: error.message ?? '',
      error: error
    };

    const errorData: any = error.response?.data ?? {};
    // If the error is formatted like : CmNestApiError
    if (errorData && errorData.status != null && errorData.code != null
      && errorData.detail != null && (errorData.instanceId != null || errorData.instance_id != null)) {
      apiError.knownError = {
        status: errorData.status,
        code: errorData.code,
        detail: errorData.detail,
        instanceId: errorData.instanceId ?? errorData.instance_id,
      };
      apiError.message = errorData.detail;
    }

    // log if log error is not set to false (default is true)
    if (logError !== false) {
      if (apiError.message) {
        Logger.error(`[BLApiService] Error during call to route '${route}' : ${apiError.message}`);
      } else {
        Logger.error(`[BLApiService] Error during call to route '${route}'`);
      }
    }
    return throwError(apiError as any);

  }
}
