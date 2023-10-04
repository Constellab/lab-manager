import {Module} from '@nestjs/common';
import {BackupService} from './backup.service';
import {CoreModule} from '../core/core.module';
import { BackupController } from './backup.controller';
import { DockerModule } from '../docker/docker.module';

@Module({
  providers: [
    BackupService,
  ],
  controllers: [
    BackupController
  ],
  imports: [
    CoreModule,
    DockerModule,
  ]
})
export class BackupModule{

}