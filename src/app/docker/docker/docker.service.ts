import {Injectable} from '@nestjs/common';
import {DockerCommandService} from '../docker-command/docker-command.service';
import {ComposeUpOptions, DockerPs} from '../docker.class';

@Injectable()
export class DockerService {

  constructor(private dockerCommand: DockerCommandService) {
  }

  public async listRunningContainer(): Promise<DockerPs[]> {
    const result = await this.dockerCommand.dockerPs();

    return JSON.parse('[' + result.slice(0, -2) + ']');
  }

  public async upContainers(options: ComposeUpOptions): Promise<any> {
    const strOptions: string[] = [];

    if (options.updateBricks) {
      strOptions.push('--up-git-bricks');
    }

    return this.dockerCommand.composeUp(strOptions);
  }

  public async downContains(): Promise<void> {
    await this.dockerCommand.composeDown();
  }

}
