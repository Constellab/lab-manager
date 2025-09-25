import { Injectable } from '@nestjs/common';
import { FileService } from '../core/services/file/file.service';
import { MainDockerCompose } from './main-docker-compose.class';

@Injectable()
export class DockerComposeFactory {
  MAIN_COMPOSE_BRICK = 'gws_core';
  MAIN_COMPOSE_UNIQUE = 'main';

  constructor(private fileService: FileService) {}

  public createMainComposeObject(): MainDockerCompose {
    const composePath = this.fileService.dockerComposePath;
    const envPath = this.fileService.envFilePath;
    return new MainDockerCompose(composePath, envPath, this.MAIN_COMPOSE_BRICK, this.MAIN_COMPOSE_UNIQUE);
  }
}
