import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { isDecoratedWithLabGuard } from '../decorators/lab-guard.decorator';
import { isDecoratedWithPublic } from '../decorators/public.decorator';
import { apiKeyHeader, authorizationSchema } from '../models/config.class';
import { CoreConfigService } from '../services/config/core-config.service';
import { FileService } from '../services/file/file.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

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

    if (apiKey === authorizationSchema + ' ' + this.configService.getLabManagerApiKey()) {
      return true;
    }

    // handle route annotated with @LabGuard
    if (isDecoratedWithLabGuard(this.reflector, context)) {
      try {
        const privateFile = this.fileService.readPrivateFile();
        return (
          apiKey === authorizationSchema + ' ' + privateFile.space.prod_api_key ||
          apiKey === authorizationSchema + ' ' + privateFile.space.dev_api_key
        );
      } catch {
        this.logger.error('[LabApiKeyGuard] Private file not found, cannot validate API key');
        return false;
      }
    }

    return false;
  }
}
