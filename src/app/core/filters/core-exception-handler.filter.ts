import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CoreConfigService } from '../services/config/core-config.service';
import { ErrorCode } from '../models/error-code.class';
import { Response, Request } from 'express';

/**
 * Format of the nest response error
 */
export interface NestApiError {
  // http status
  status: HttpStatus;

  // unique error code
  code: string;

  // unique id of this error instance
  detail?: string;

  // unique id of this error instance
  instanceId: string;
}

/**
 * Class to catch all exception and translate it if possible
 */
@Catch()
export class CoreExceptionHandlerFilter implements ExceptionFilter {
  private readonly logger = new Logger(CoreExceptionHandlerFilter.name);

  constructor(protected coreConfigService: CoreConfigService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const response: Response = host.switchToHttp().getResponse();
    try {
      const error: NestApiError = await this.handleError(exception as any, host.switchToHttp().getRequest());

      response.status(error.status).json(error);
    } catch (e) {
      const instanceId: string = CoreExceptionHandlerFilter.generateUUID();
      // use catch error if an error is raised in handleError method
      // because it would break the app
      this.logger.error('Unexpected error thrown in CustomExceptionHandlerFilter | InstanceId ' + instanceId);
      const error: NestApiError = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: ErrorCode.SERVER_ERROR,
        code: ErrorCode[ErrorCode.SERVER_ERROR],
        instanceId: instanceId,
      };
      response.status(error.status).json(error);
    }
  }

  private async handleError(error: Error, request: Request): Promise<NestApiError> {
    if (error instanceof HttpException) {
      return this.convertToNestError(error.name, error.message, error.getStatus());
    }

    const instanceId: string = CoreExceptionHandlerFilter.generateUUID();

    // log the error
    this.logError(error, request, instanceId);

    // in prod env, send a server error exception to hide detail for the user
    if (this.coreConfigService.isProduction()) {
      return this.convertToNestError(
        ErrorCode[ErrorCode.SERVER_ERROR],
        ErrorCode.SERVER_ERROR,
        HttpStatus.BAD_REQUEST
      );
    } else {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: error.name,
        detail: error.message,
        instanceId: instanceId,
      };
    }
  }

  // method to log the error in the console with context info
  private logError(error: Error, request: Request, instanceId: string): void {
    this.logger.error(
      `Error during request ${request.url} | Method ${request.method} | InstanceId ${instanceId}`
    );
    this.logger.error(error.stack);
  }

  /**
   * Translate the message and return an error observable with status
   */
  private convertToNestError(errorCode: string, errorMessage: string, status: HttpStatus): NestApiError {
    return {
      status: status,
      code: errorCode,
      detail: errorMessage,
      instanceId: CoreExceptionHandlerFilter.generateUUID(),
    };
  }

  /**
   * Generate an UUID v4, it is not a simple uuid ID and must not used for encryption
   */
  public static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
