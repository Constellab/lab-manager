import { Body } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { BackupInfoDto, LabBackup, LabBackupHistory } from './backup.class';
import { BackupService } from './backup.service';


@Controller('backup')
export class BackupController {


  constructor(private backupService: BackupService) {
  }


  @Post('prod')
  createProdBackup(@Body() createBackup: BackupInfoDto): Promise<LabBackup> {
    return this.backupService.checkAndCreateProdBackup(createBackup);
  }


  @Post('stop-current')
  stopCurrentBackup(): boolean {
    return this.backupService.stopCurrentBackup();
  }

  @Get('last-status')
  getLastBackup(): LabBackup {
    return this.backupService.getLastBackupStatus();
  }

  // deprecated to remove once all labs uses v1.3.0
  @Get('current-status')
  currentStatus(): LabBackup {
    return this.backupService.getLastBackupStatus();
  }

  @Get('history')
  getBackupHistory(): LabBackupHistory {
    return this.backupService.getBackupHistory();
  }
}
