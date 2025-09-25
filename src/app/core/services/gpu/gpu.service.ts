import { Injectable } from '@nestjs/common';
import { Command } from '../../utils/command';

/**
 * Service to manage the GPU
 */
@Injectable()
export class GPUService {
  constructor() {}

  public async isGpu(): Promise<boolean> {
    try {
      // to check if this is a GPU server, check if nvidia is installed
      const command = new Command();
      const nvidia = await command.execCommand('lspci | grep -i nvidia');
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
