import { Injectable, Logger } from '@nestjs/common';
import { GPUService } from 'src/app/core/services/gpu/gpu.service';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { FileService } from '../../core/services/file/file.service';
import { DockerProgress, ErrorLogs } from '../docker.class';
import { DockerComposeInspect } from './docker-compose-inspect.class';
import { DockerComposeService } from './docker-compose.service';

/**
 * Service to manage the main docker-compose file and its services
 */
@Injectable()
export class MainComposeService {
  private readonly logger = new Logger(MainComposeService.name);

  constructor(
    private fileService: FileService,
    private gpuService: GPUService,
    private configService: CoreConfigService,
    private dockerComposeService: DockerComposeService
  ) {}

  public async inspectContainers(): Promise<DockerComposeInspect> {
    if (!this.fileService.dockerComposeFileExists()) {
      return new DockerComposeInspect();
    }

    try{
      const mainCompose = this.dockerComposeService.createMainComposeObject();
      return await mainCompose.composeInspect();
    } catch (e) {
      this.logger.error('Error inspecting main docker compose', e);
      return new DockerComposeInspect();
    }
  }

  /**
   * Get start error logs from the glab container
   */
  public async getGlabStartErrorLogs(mode: 'prod' | 'dev'): Promise<ErrorLogs> {
    const logs = this.fileService.readLogStartFileIfExists(mode);
    if (!logs) return null;

    return {
      logs: logs.errors.join('\n'),
      mainErrors: logs.main_errors,
    };
  }

  public async getGlabStartProgressLogs(mode: 'prod' | 'dev'): Promise<DockerProgress> {
    const logs = this.fileService.readLogStartFileIfExists(mode);
    if (!logs) return null;

    return logs.progress;
  }

  public async generateDockerCompose(): Promise<void> {
    const dockerComposeFileName = this.fileService.dockerComposeFileName;
    this.logger.log(`Generating ${dockerComposeFileName} file`);
    let dockerComposeContent = this.fileService.readDockerComposeTemplate();

    if (!this.configService.isLocal()) {
      // replace the GPU config in the docker-compose file
      const gpuConfig = await this.gpuService.getDockerComposeGpuConfig();
      dockerComposeContent = dockerComposeContent.replace(/#GPU_CONFIG#/g, gpuConfig);

      const frontProdDomains = ['lab', 'front'];
      const frontDevDomains = ['dev-lab'];

      // list of variable in the docker-compose file that need to be replaced
      const toReplaces = [
        {
          subDomains: ['glab'],
          replacementText: '#GLAB_HOST#',
        },
        {
          subDomains: [...frontProdDomains, ...frontDevDomains],
          replacementText: '#FRONT_LAB_HOST#',
        },
      ];

      for (const toReplace of toReplaces) {
        const newContent = this.buildHostString(toReplace.subDomains);

        // replace all the content in the docker-compose file
        dockerComposeContent = dockerComposeContent.replace(
          new RegExp(toReplace.replacementText, 'g'),
          newContent
        );
      }

      // provide the PROD_FRONT_URLS and DEV_FRONT_URLS to the docker-compose file
      const prodFrontUrls = this.buildFrontUrls(frontProdDomains);
      dockerComposeContent = dockerComposeContent.replace(
        new RegExp('#FRONT_PROD_URLS#', 'g'),
        prodFrontUrls
      );

      const devFrontUrls = this.buildFrontUrls(frontDevDomains);
      dockerComposeContent = dockerComposeContent.replace(new RegExp('#FRONT_DEV_URLS#', 'g'), devFrontUrls);
    }

    this.fileService.writeDockerCompose(dockerComposeContent);
    this.logger.log(`${dockerComposeFileName} file generated`);
  }

  private buildHostString(subDomains: string[]): string {
    // build the standard host string like : Host(`glab.${VIRTUAL_HOST}`)
    const hosts: string[] = [];

    for (const subDomain of subDomains) {
      hosts.push('Host(`' + subDomain + '.${VIRTUAL_HOST}`)');

      const additionalDomains = this.configService.getAddtionalDomains();
      // if there are additional hosts, add them to the host string
      if (additionalDomains && additionalDomains.length > 0) {
        for (const additionalHost of additionalDomains) {
          // add an host for each additional host, keep the same sub domain
          hosts.push(`Host(\`${subDomain}.${additionalHost}\`)`);
        }
      }
    }

    return hosts.join(' || ');
  }

  private buildFrontUrls(subDomains: string[]): string {
    return subDomains.map((subDomain) => 'https://' + subDomain + '.${VIRTUAL_HOST}').join(',');
  }

  public async stopServices(): Promise<void> {
    const mainCompose = this.dockerComposeService.createMainComposeObject();
    await mainCompose.composeStop();
  }
}
