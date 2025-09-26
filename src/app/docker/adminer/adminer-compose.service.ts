import { Injectable } from '@nestjs/common';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { FileService } from 'src/app/core/services/file/file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { DockerComposeYaml } from '../compose/docker-compose-yaml';
import { DockerCompose } from '../compose/docker-compose.class';
import { DockerComposeService } from '../compose/docker-compose.service';
import { AdminerInfo } from './adminer.class';

@Injectable()
export class AdminerComposeService {
  public static readonly ADMINER_BRICK_NAME = 'gws_core';
  public static readonly ADMINER_UNIQUE_NAME = 'adminer';
  public static readonly ADMINER_SERVICE_NAME = 'adminer';

  private static readonly ADMINER_DESKTOP_PORT = 8081;
  private static readonly ADMINER_INNTER_PORT = 8080;

  private static readonly ADMINER_TEMPLATE_FILE = 'docker-compose-adminer.yml';

  constructor(
    private taskService: TaskService,
    private coreConfigService: CoreConfigService,
    private fileService: FileService,
    private dockerComposeService: DockerComposeService
  ) {}

  public getExistingAdminerCompose(): DockerCompose | null {
    return this.dockerComposeService.getDockerCompose(
      AdminerComposeService.ADMINER_BRICK_NAME,
      AdminerComposeService.ADMINER_UNIQUE_NAME
    );
  }

  public async adminerIsRunning(): Promise<boolean> {
    const dockerCompose = this.getExistingAdminerCompose();
    if (!dockerCompose) {
      return false;
    }
    return dockerCompose.oneServiceIsRunning();
  }

  public async startAdminerContainer(): Promise<boolean> {
    const taskName = 'Start adminer service';
    this.taskService.newTask(taskName);

    try {
      const templatePath = this.coreConfigService.getAssetPath(AdminerComposeService.ADMINER_TEMPLATE_FILE);
      const dockerYaml = DockerComposeYaml.fromFile(templatePath);

      // in local we add a port mapping, in prod we add traefik labels
      if (this.coreConfigService.isLocal()) {
        dockerYaml.addPortMapping(
          AdminerComposeService.ADMINER_SERVICE_NAME,
          AdminerComposeService.ADMINER_DESKTOP_PORT,
          AdminerComposeService.ADMINER_INNTER_PORT
        );
      } else {
        const host =
          AdminerComposeService.ADMINER_SERVICE_NAME + '.' + this.coreConfigService.getVirtualHost();
        dockerYaml.addTraefikLabels(
          AdminerComposeService.ADMINER_SERVICE_NAME,
          host,
          AdminerComposeService.ADMINER_INNTER_PORT
        );
      }

      const dockerCompose = await this.dockerComposeService.registerSubCompose(
        dockerYaml,
        AdminerComposeService.ADMINER_BRICK_NAME,
        AdminerComposeService.ADMINER_UNIQUE_NAME
      );
      const wasStarted = await dockerCompose.composeUp();

      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return wasStarted != null;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async deleteAdminerContainer(): Promise<boolean> {
    const dockerCompose = this.getExistingAdminerCompose();
    if (!dockerCompose) {
      return false;
    }

    const taskName = 'Stop adminer service';
    this.taskService.newTask(taskName);

    try {
      const wasStopped = await dockerCompose.composeDown();

      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return wasStopped != null;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  public async getAdminerInfo(): Promise<AdminerInfo> {
    let url: string;
    if (this.coreConfigService.isLocal()) {
      url = `http://localhost:8081`;
    } else {
      url = `https://adminer.${this.coreConfigService.getVirtualHost()}`;
    }

    const privateFile = this.fileService.readPrivateFile();

    const adminerInfo: AdminerInfo = {
      url: url,

      gwsCoreProd: {
        host: 'gws_core_prod_db',
        username: 'gws_core',
        dbName: 'gws_core',
        password: privateFile.db.gws_core_prod_password,
      },

      gwsCoreDev: {
        host: 'gws_core_dev_db',
        username: 'gws_core',
        dbName: 'gws_core',
        password: privateFile.db.gws_core_dev_password,
      },

      gwsBiota: {
        host: 'gws_biota_db',
        username: 'gws_biota',
        dbName: 'gws_biota',
        password: 'gencovery',
      },
    };

    return adminerInfo;
  }
}
