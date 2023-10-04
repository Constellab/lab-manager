import { Body } from '@nestjs/common';
import { Controller, Get, Post } from '@nestjs/common';
import { BackupInfoDTO, LabBackupStorage, LabBackupStorageI } from './backup.class';
import { BackupService } from './backup.service';
import { LabBackupHistory } from './backup-history.class';


@Controller('backup')
export class BackupController {


  constructor(private backupService: BackupService) {
  }


  @Post('prod')
  async createProdBackup(@Body() createBackup: BackupInfoDTO): Promise<LabBackupStorageI[]> {
    const backup = await this.backupService.checkAndCreateProdBackup(createBackup);
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
}
