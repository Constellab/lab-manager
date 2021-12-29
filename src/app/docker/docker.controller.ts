import {Controller, Get} from '@nestjs/common';
import {Public} from '../core/decorator/public.decorator';
import {DockerService} from './docker/docker.service';

@Controller('docker')
export class DockerController {

  constructor(private dockerService: DockerService) {
  }

  @Public()
  @Get('test')
  async test(): Promise<any> {
    return await this.dockerService.listRunningContainer();
  }
}
