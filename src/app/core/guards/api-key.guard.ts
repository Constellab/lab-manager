import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Request,} from 'express';
import {apiKeyHeader, authorizationSchema} from '../models/config.class';
import {CoreConfigService} from '../services/config/core-config.service';
import {isDecoratedWithPublic} from '../decorators/public.decorator';
import {Reflector} from '@nestjs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {

  constructor(private configService: CoreConfigService,
    private reflector: Reflector) {
  }

  canActivate(context: ExecutionContext): boolean {
    if (isDecoratedWithPublic(this.reflector, context)) {
      return true;
    }

    // in desktop mode, this is local, no need for api key
    if(this.configService.isDekstop()) return true;

    const req: Request = context.switchToHttp().getRequest();

    const apiKey = req.header(apiKeyHeader);

    if (!apiKey) return false;
    return apiKey === authorizationSchema + ' ' + this.configService.getLabManagerApiKey();
  }
}
