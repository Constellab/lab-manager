import {Module} from '@nestjs/common';
import {BackupService} from './backup.service';
import {CoreModule} from '../core/core.module';

@Module({
  providers: [
    BackupService,
  ],
  imports: [
    CoreModule
  ]
})
export class BackupModule{

}