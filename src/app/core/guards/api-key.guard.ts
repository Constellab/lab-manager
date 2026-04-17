import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthContextService } from '../auth/auth-context.service';
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
      // Set context for public routes
      AuthContextService.setContext({
        type: 'public',
      });
      return true;
    }

    const req: Request = context.switchToHttp().getRequest();

    // CHeck authentication from Space
    const apiKey = req.header(apiKeyHeader);

    if (apiKey) {
      if (apiKey === authorizationSchema + ' ' + this.configService.getLabManagerApiKey()) {
        AuthContextService.setContext({
          type: 'space',
        });
        return true;
      }

      // handle route annotated with @LabGuard for lab authentication
      if (isDecoratedWithLabGuard(this.reflector, context)) {
        try {
          const privateFile = this.fileService.readPrivateFile();
          if (apiKey === authorizationSchema + ' ' + privateFile.space.prod_api_key) {
            AuthContextService.setContext({
              type: 'lab',
              env: 'prod',
            });
            return true;
          }

          if (apiKey === authorizationSchema + ' ' + privateFile.space.dev_api_key) {
            AuthContextService.setContext({
              type: 'lab',
              env: 'dev',
            });
            return true;
          }
        } catch {
          this.logger.error('[LabApiKeyGuard] Private file not found, cannot validate API key');
        }
      }
    }

    // in local or private-cloud, no need for api key
    if (!this.configService.apiKeyIsRequired()) {
      AuthContextService.setContext({
        type: 'local',
      });
      return true;
    }

    return false;
  }
}
