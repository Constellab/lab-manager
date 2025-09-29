import { Controller, Get, Put } from '@nestjs/common';
import { AdminerComposeService } from './adminer-compose.service';
import { AdminerInfo } from './adminer.class';

@Controller('adminer')
export class AdminerController {
  constructor(private adminerService: AdminerComposeService) {}

  @Put('start')
  startAdminer(): Promise<boolean> {
    return this.adminerService.startAdminerContainer();
  }

  @Put('stop')
  stopAdminer(): Promise<boolean> {
    return this.adminerService.deleteAdminerContainer();
  }

  @Get('info')
  getAdminerInfo(): Promise<AdminerInfo> {
    return this.adminerService.getAdminerInfo();
  }
}
