import { Body, Param } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { BackupInfoDTO, BackupRestoreDTO, BackupTriggerMode } from './backup.class';
import { BackupService } from './backup.service';
import { LabBackupHistory, LabBackupHistoryI } from './backup-history.class';


@Controller('backup')
export class BackupController {


  constructor(private backupService: BackupService) {
  }


  @Post('prod/:mode')
  async createProdBackup(@Body() createBackup: BackupInfoDTO,
    @Param('mode') triggerMode: BackupTriggerMode): Promise<LabBackupHistoryI> {
    const backup = await this.backupService.createMultipleProdBackup(createBackup, triggerMode);
    return backup.toJson();
  }


  @Post('stop-current')
  stopCurrentBackup(): LabBackupHistoryI {
    const backups = this.backupService.stopCurrentBackups();
    return new LabBackupHistory(backups).toJson();
  }

  @Get('last-status')
  getLastBackup(): LabBackupHistoryI {
    const backups = this.backupService.getCurrentBackupStatus();
    return new LabBackupHistory(backups).toJson();
  }


  @Get('history')
  getBackupHistory(): LabBackupHistoryI {
    return this.backupService.getBackupHistory().toJson();
  }

  @Post('restore')
  restoreBackup(@Body() backupRestore: BackupRestoreDTO): Promise<void> {
    return this.backupService.restoreBackup(backupRestore);
  }
}
