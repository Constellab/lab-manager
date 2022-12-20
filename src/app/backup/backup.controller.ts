import { Body } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { CreateBackupDto, LabBackup, LabBackupHistory } from './backup.class';
import { BackupService } from './backup.service';


@Controller('backup')
export class BackupController {


  constructor(private backupService: BackupService) {
  }


  @Post('prod')
  createProdBackup(@Body() createBackup: CreateBackupDto): LabBackup {
    return this.backupService.createProdBackup(createBackup);
  }


  @Post('stop-current')
  stopCurrentBackup(): boolean {
    return this.backupService.stopCurrentBackup();
  }

  @Get('current-status')
  getCurrentStatus(): LabBackup {
    return this.backupService.getCurrentBackupStatus();
  }

  @Get('history')
  getBackupHistory(): LabBackupHistory {
    return this.backupService.getBackupHistory();
  }
}
