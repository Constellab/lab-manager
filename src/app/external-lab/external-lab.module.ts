import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { DockerModule } from '../docker/docker.module';
import { ExternalLabController } from 'src/app/external-lab/external-lab.controller';
@Module({
  providers: [],
  controllers: [ExternalLabController],
  imports: [CoreModule, DockerModule],
})
export class ExternalLabModule {}
