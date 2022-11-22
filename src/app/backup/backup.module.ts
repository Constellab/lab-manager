import {Module} from '@nestjs/common';
import {BackupService} from './backup.service';
import {CoreModule} from '../core/core.module';
import { BackupController } from './backup.controller';

@Module({
  providers: [
    BackupService,
  ],
  controllers: [
    BackupController
  ],
  imports: [
    CoreModule
  ]
})
export class BackupModule{

}