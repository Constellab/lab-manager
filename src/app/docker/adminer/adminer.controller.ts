import { Controller, Get, Put } from '@nestjs/common';
import { AdminerComposeService } from './adminer-compose.service';
import { AdminerInfo } from './adminer.class';

@Controller('adminer')
export class AdminerController {
  constructor(private adminerService: AdminerComposeService) {}

  @Put('start')
  startAdminer(): Promise<void> {
    return this.adminerService.startAdminerContainer();
  }

  @Put('stop')
  stopAdminer(): Promise<void> {
    return this.adminerService.deleteAdminerContainer();
  }

  @Get('info')
  getAdminerInfo(): Promise<AdminerInfo> {
    return this.adminerService.getAdminerInfo();
  }
}
