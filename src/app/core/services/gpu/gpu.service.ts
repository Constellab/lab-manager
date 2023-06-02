import { Injectable } from '@nestjs/common';
import { CommandService } from '../command/command.service';


/**
 * Service to manage the GPU
 */
@Injectable()
export class GPUService {

  constructor(private commandService: CommandService) {
  }

  public async isGpu(): Promise<boolean> {
    try {
      // to check if this is a GPU server, check if nvidia is installed
      const nvidia = await this.commandService.execCommand('lspci | grep -i nvidia');
      return nvidia != '';
    } catch (_) {
      return false;
    }
  }

  public async getDockerComposeGpuConfig(): Promise<string> {
    if (!(await this.isGpu())) {
      return '';
    }
    // config for the docker-compose file, tabulation is important
    return `# GPU configuration
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]`;
  }
}