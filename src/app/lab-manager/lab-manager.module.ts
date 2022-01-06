import { Module } from '@nestjs/common';
import { LabManagerService } from './lab-manager.service';

@Module({
  providers: [LabManagerService]
})
export class LabManagerModule {}
