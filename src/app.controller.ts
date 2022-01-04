import {Controller, Get} from '@nestjs/common';
import {Public} from './app/core/decorators/public.decorator';

@Controller()
export class AppController {

  @Public()
  @Get('health-check')
  healthCheck(): boolean {
    return true;
  }
}
