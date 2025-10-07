import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { TaskService } from '../core/services/task/task.service';
import { DockerComposeYaml } from '../docker/compose/docker-compose-yaml';
import { DockerCompose } from '../docker/compose/docker-compose.class';
import { DockerComposeService } from '../docker/compose/docker-compose.service';
import { DockerComposeUniqueId } from '../docker/compose/docker-compose.types';

@Injectable()
export class LabDesktopComposeService implements OnModuleInit {
  public static readonly LAB_DESKTOP_ID: DockerComposeUniqueId = {
    brickName: 'gws_core',
    uniqueName: 'lab_desktop',
    env: 'none',
  };
  public static readonly LAB_DESKTOP_SERVICE_NAME = 'lab_desktop';

  private static readonly LAB_DESKTOP_IMAGE_NAME = 'constellab/lab-manager-standalone';

  private static readonly LAB_DESKTOP_TEMPLATE_FILE = 'docker-compose-lab-desktop.yml';

  private readonly logger = new Logger(LabDesktopComposeService.name);

  constructor(
    private taskService: TaskService,
    private coreConfigService: CoreConfigService,
    private dockerComposeService: DockerComposeService
  ) {}

  onModuleInit(): void {
    if (this.coreConfigService.isDesktop()) {
      this.startLabDesktopContainer().catch((e) => {
        this.logger.error('Error while starting the lab manager standalone container', e);
      });
    }
  }

  public getExistingLabDesktopCompose(): DockerCompose | null {
    return this.dockerComposeService.getDockerCompose(LabDesktopComposeService.LAB_DESKTOP_ID);
  }

  public async labDesktopIsRunning(): Promise<boolean> {
    const dockerCompose = this.getExistingLabDesktopCompose();
    if (!dockerCompose) {
      return false;
    }
    return dockerCompose.oneServiceIsRunning();
  }

  private async startLabDesktopContainer(): Promise<boolean> {
    const taskName = 'Start lab desktop service';
    this.taskService.newTask(taskName);

    try {
      const templatePath = this.coreConfigService.getAssetPath(
        LabDesktopComposeService.LAB_DESKTOP_TEMPLATE_FILE
      );
      const dockerYaml = DockerComposeYaml.fromTemplateFile(
        templatePath,
        LabDesktopComposeService.LAB_DESKTOP_ID
      );

      const expectedVersion = this.coreConfigService.getLabManagerStandaloneFrontVersion();
      const expectedImage = LabDesktopComposeService.LAB_DESKTOP_IMAGE_NAME + ':' + expectedVersion;

      dockerYaml.content.services[LabDesktopComposeService.LAB_DESKTOP_SERVICE_NAME].image = expectedImage;

      dockerYaml.addEnvironmentVariable(
        LabDesktopComposeService.LAB_DESKTOP_SERVICE_NAME,
        'COMMUNITY_API_URL',
        this.coreConfigService.getDesktopCommunityApiUrl()
      );
      dockerYaml.addEnvironmentVariable(
        LabDesktopComposeService.LAB_DESKTOP_SERVICE_NAME,
        'COMMUNITY_FRONT_URL',
        this.coreConfigService.getDesktopCommunityFrontUrl()
      );
      dockerYaml.addEnvironmentVariable(
        LabDesktopComposeService.LAB_DESKTOP_SERVICE_NAME,
        'API_URL',
        `http://localhost:${this.coreConfigService.getPort()}`
      );

      const dockerCompose = await this.dockerComposeService.registerSubCompose(dockerYaml, {
        description: 'Lab Manager Desktop - Standalone version of Lab Manager',
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
}
