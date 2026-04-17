import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { TaskService } from '../core/services/task/task.service';
import { DockerComposeYaml } from '../docker/compose/docker-compose-yaml';
import { DockerCompose } from '../docker/compose/docker-compose.class';
import { DockerComposeService } from '../docker/compose/docker-compose.service';
import { DockerComposeUniqueId } from '../docker/compose/docker-compose.types';

@Injectable()
export class LabStandaloneFrontComposeService implements OnModuleInit {
  // Keep uniqueName 'lab_desktop' so existing deployments keep recognizing the registered sub-compose.
  public static readonly STANDALONE_FRONT_ID: DockerComposeUniqueId = {
    brickName: 'gws_core',
    uniqueName: 'lab_desktop',
    env: 'none',
  };
  public static readonly STANDALONE_FRONT_SERVICE_NAME = 'lab_desktop';

  private static readonly STANDALONE_FRONT_IMAGE_NAME = 'constellab/lab-manager-standalone';

  private static readonly STANDALONE_FRONT_TEMPLATE_FILE = 'docker-compose-lab-desktop.yml';

  private readonly logger = new Logger(LabStandaloneFrontComposeService.name);

  constructor(
    private taskService: TaskService,
    private coreConfigService: CoreConfigService,
    private dockerComposeService: DockerComposeService
  ) {}

  onModuleInit(): void {
    if (this.coreConfigService.isDesktop() || this.coreConfigService.isPrivateCloud()) {
      this.startStandaloneFrontContainer().catch((e) => {
        this.logger.error('Error while starting the lab manager standalone container', e);
      });
    }
  }

  public getExistingStandaloneFrontCompose(): DockerCompose | null {
    return this.dockerComposeService.getDockerCompose(LabStandaloneFrontComposeService.STANDALONE_FRONT_ID);
  }

  public async standaloneFrontIsRunning(): Promise<boolean> {
    const dockerCompose = this.getExistingStandaloneFrontCompose();
    if (!dockerCompose) {
      return false;
    }
    return dockerCompose.oneServiceIsRunning();
  }

  private async startStandaloneFrontContainer(): Promise<boolean> {
    const taskName = 'Start lab standalone front service';
    this.taskService.newTask(taskName);

    try {
      const templatePath = this.coreConfigService.getAssetPath(
        LabStandaloneFrontComposeService.STANDALONE_FRONT_TEMPLATE_FILE
      );
      const dockerYaml = DockerComposeYaml.fromTemplateFile(
        templatePath,
        LabStandaloneFrontComposeService.STANDALONE_FRONT_ID
      );

      const expectedVersion = this.coreConfigService.getLabManagerStandaloneFrontVersion();
      const expectedImage =
        LabStandaloneFrontComposeService.STANDALONE_FRONT_IMAGE_NAME + ':' + expectedVersion;

      const serviceName = LabStandaloneFrontComposeService.STANDALONE_FRONT_SERVICE_NAME;
      dockerYaml.content.services[serviceName].image = expectedImage;

      const isPrivateCloud = this.coreConfigService.isPrivateCloud();

      dockerYaml.addEnvironmentVariable(
        serviceName,
        'COMMUNITY_API_URL',
        this.coreConfigService.getDesktopCommunityApiUrl()
      );
      dockerYaml.addEnvironmentVariable(
        serviceName,
        'COMMUNITY_FRONT_URL',
        this.coreConfigService.getDesktopCommunityFrontUrl()
      );
      dockerYaml.addEnvironmentVariable(
        serviceName,
        'API_URL',
        isPrivateCloud
          ? `https://lab-manager.${this.coreConfigService.getVirtualHost()}`
          : `http://localhost:${this.coreConfigService.getPort()}`
      );

      if (isPrivateCloud) {
        this.applyPrivateCloudTraefikConfig(dockerYaml, serviceName);
      }

      const dockerCompose = await this.dockerComposeService.registerSubCompose(dockerYaml, {
        description: 'Lab Manager Standalone Front - configuration UI for the lab manager',
        autoStart: false, // this is handled by the onModuleInit
      });

      // We force recreate to ensure the latest image is used
      const wasStarted = await dockerCompose.composeUp(['--pull always']);

      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return wasStarted != null;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  /**
   * In private-cloud mode the standalone front is exposed via traefik on
   * `lab-config.${VIRTUAL_HOST}` rather than the host port mapping used in desktop mode.
   */
  private applyPrivateCloudTraefikConfig(dockerYaml: DockerComposeYaml, serviceName: string): void {
    const virtualHost = this.coreConfigService.getVirtualHost();
    const routerName = 'lab-desktop-router';
    const traefikServiceName = 'lab-desktop-service';

    dockerYaml.addLabels(serviceName, [
      'traefik.enable=true',
      `traefik.http.routers.${routerName}.rule=Host(\`lab-config.${virtualHost}\`)`,
      `traefik.http.routers.${routerName}.service=${traefikServiceName}`,
      `traefik.http.services.${traefikServiceName}.loadbalancer.server.port=80`,
      `traefik.http.routers.${routerName}.entrypoints=websecure`,
      `traefik.http.routers.${routerName}.tls=true`,
    ]);

    // Drop the host port mapping; traefik handles ingress.
    delete dockerYaml.content.services[serviceName].ports;

    dockerYaml.addProdNetwork(serviceName);
  }
}
