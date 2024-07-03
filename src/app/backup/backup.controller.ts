import { Body, Param } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { BackupInfoDTO, BackupRestoreDTO, BackupTriggerMode, LabBackupStorageI } from './backup.class';
import { BackupService } from './backup.service';
import { LabBackupHistory } from './backup-history.class';


@Controller('backup')
export class BackupController {


  constructor(private backupService: BackupService) {
  }


  @Post('prod/:mode')
  async createProdBackup(@Body() createBackup: BackupInfoDTO,
    @Param('mode') triggerMode: BackupTriggerMode): Promise<LabBackupStorageI[]> {
    const backup = await this.backupService.createMultipleProdBackup(createBackup, triggerMode);
    return backup.map(backup => backup.toJson());
  }


  @Post('stop-current')
  stopCurrentBackup(): LabBackupStorageI[] {
    return this.backupService.stopCurrentBackups().map(backup => backup.toJson());
  }

  @Get('last-status')
  getLastBackup(): LabBackupStorageI[] {
    return this.backupService.getCurrentBackupStatus().map(backup => backup.toJson());
  }


  @Get('history')
  getBackupHistory(): LabBackupHistory {
    return this.backupService.getBackupHistory().toJson();
  }

  @Post('restore')
  restoreBackup(@Body() backupRestore: BackupRestoreDTO): Promise<void> {
    return this.backupService.restoreBackup(backupRestore);
  }


}
