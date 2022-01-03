import {Injectable} from '@nestjs/common';
import {DockerCommandService} from '../docker-command/docker-command.service';
import {ComposeUpOptions, DockerPs} from '../docker.class';

@Injectable()
export class DockerService {

  constructor(private dockerCommand: DockerCommandService) {
  }

  public async listContainers(): Promise<DockerPs[]> {
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

  public async downContainers(): Promise<void> {
    await this.dockerCommand.composeDown();
  }

  public async restartContainers(options: ComposeUpOptions): Promise<any> {
    await this.downContainers();

    return await this.upContainers(options);
  }

  public async getLogs(containerName: string): Promise<string> {
    return await this.dockerCommand.getLogs(containerName);
  }
}
