import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { apiKeyHeader, authorizationSchema } from '../models/config.class';
import { CoreConfigService } from '../services/config/core-config.service';
import { isDecoratedWithPublic } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';
import { FileService } from 'src/app/core/services/file/file.service';
import { PrivateFile } from 'src/app/core/models/private-file.class';

/**
 * Guard for the request that comes from the lab to the API.
 * Used when a route is decorated with @LabGuard
 */
@Injectable()
export class LabApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(LabApiKeyGuard.name);

  constructor(
    private configService: CoreConfigService,
    private fileService: FileService,
    private reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (isDecoratedWithPublic(this.reflector, context)) {
      return true;
    }

    // in local, no need for api key
    if (this.configService.isLocal()) return true;

    const req: Request = context.switchToHttp().getRequest();

    const apiKey = req.header(apiKeyHeader);

    if (!apiKey) return false;

    let privateFile: PrivateFile;
    try {
      privateFile = this.fileService.readPrivateFile();
    } catch {
      this.logger.error('[LabApiKeyGuard] Private file not found, cannot validate API key');
      return false;
    }

    // TODO : handle dev api keys
    return apiKey === authorizationSchema + ' ' + privateFile.space.prod_api_key;
  }
}
