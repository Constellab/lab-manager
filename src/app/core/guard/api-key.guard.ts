import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Request,} from 'express';
import {apiKeyHeader} from '../model/config.class';
import {CoreConfigService} from '../service/config/core-config.service';
import {isDecoratedWithPublic} from '../decorator/public.decorator';
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

    const req: Request = context.switchToHttp().getRequest();

    const apiKey = req.header(apiKeyHeader);

    return apiKey === this.configService.getLabManagerApiKey();
  }
}
