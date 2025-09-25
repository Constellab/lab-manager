import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CoreConfigService } from '../core/services/config/core-config.service';
import { DockerCommand } from '../docker/docker-command.class';
import { DockerRunOptionsPort } from '../docker/docker.class';

/**
 * Specific management for the lab manager standalone front
 */
@Injectable()
export class LabDesktopService implements OnModuleInit {
  private static readonly IMAGE_NAME = 'constellab/lab-manager-standalone';
  private static readonly CONTAINER_NAME = 'lab_manager_standalone';
  private static readonly PORT: DockerRunOptionsPort = {
    host: 82,
    container: 80, // nginx port
  };

  private readonly logger = new Logger(LabDesktopService.name);

  constructor(private coreConfigService: CoreConfigService) {}

  onModuleInit(): void {
    if (this.coreConfigService.isDesktop()) {
      this.startLabManagerStandaloneFront().catch((e) => {
        this.logger.error('Error while starting the lab manager standalone container', e);
      });
    }
  }

  /**
   * In desktop env, we automatically starts the lab manager standalone front
   */
  private async startLabManagerStandaloneFront(): Promise<void> {
    this.logger.log(`Starting container '${LabDesktopService.CONTAINER_NAME}'`);
    // check if the container exists
    const dockerCommand = new DockerCommand();
    const container = await dockerCommand.dockerInspect(LabDesktopService.CONTAINER_NAME);

    const expectedVersion = this.coreConfigService.getLabManagerStandaloneFrontVersion();
    const expectedImage = LabDesktopService.IMAGE_NAME + ':' + expectedVersion;

    // if the container exists
    if (container.exists()) {
      // if the image of the front is not the correct one
      if (container.image !== expectedImage) {
        // delete the container
        this.logger.log(
          `The image of the container '${LabDesktopService.CONTAINER_NAME}' is not the correct one.` +
            ` Current image '${container.image}', expected image '${expectedImage}'. Deleting the container.`
        );
        await dockerCommand.dockerRmContainer(LabDesktopService.CONTAINER_NAME);
        this.logger.log(`Container '${LabDesktopService.CONTAINER_NAME}' deleted.`);

        // if the container is in error, we delete it
      } else if (container.isError()) {
        this.logger.log(
          `The container '${LabDesktopService.CONTAINER_NAME}' is in error. Deleting the container.`
        );
        await dockerCommand.dockerRmContainer(LabDesktopService.CONTAINER_NAME);
        this.logger.log(`Container '${LabDesktopService.CONTAINER_NAME}' deleted.`);
        // if the container is not running, we start it
      } else if (!container.isRunning()) {
        // start the container and return
        this.logger.log(`Starting the container '${LabDesktopService.CONTAINER_NAME}'`);
        await dockerCommand.startContainer(LabDesktopService.CONTAINER_NAME);
        this.logger.log(`Container '${LabDesktopService.CONTAINER_NAME}' started.`);
        return;

        // if the container is already running, we return
      } else {
        this.logger.log(`The container '${LabDesktopService.CONTAINER_NAME}' is already running.`);
        return;
      }
    }

    // if the container does not exist, we create it
    this.logger.log(`Creating the container '${LabDesktopService.CONTAINER_NAME}'`);
    await dockerCommand.dockerRun(expectedImage, LabDesktopService.CONTAINER_NAME, {
      ports: [LabDesktopService.PORT],
      envs: {
        COMMUNITY_API_URL: this.coreConfigService.getDesktopCommunityApiUrl(),
        COMMUNITY_FRONT_URL: this.coreConfigService.getDesktopCommunityFrontUrl(),
        API_URL: `http://localhost:${this.coreConfigService.getPort()}`, // get current API URL
      },
    });

    this.logger.log(
      `Container '${LabDesktopService.CONTAINER_NAME}' created, app available at` +
        ` http://localhost:${LabDesktopService.PORT.host}`
    );
  }
}
