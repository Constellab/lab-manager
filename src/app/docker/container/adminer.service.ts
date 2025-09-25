import { Injectable } from '@nestjs/common';
import { CoreConfigService } from 'src/app/core/services/config/core-config.service';
import { FileService } from 'src/app/core/services/file/file.service';
import { TaskService } from 'src/app/core/services/task/task.service';
import { TraefikService } from 'src/app/core/services/traefik/traefik.service';
import { DockerCommand } from '../docker-command.class';
import { DockerRunOptionsPort } from '../docker.class';
import { AdminerInfo } from './container.class';

@Injectable()
export class AdminerService {
  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly ADMINER_NAME = 'adminer';
  public static readonly ADMINER_IMAGE: string = 'adminer:4.8.1';

  private static readonly ADMINER_DESKTOP_PORT = 8081;

  constructor(
    private taskService: TaskService,
    private traefikService: TraefikService,
    private coreConfigService: CoreConfigService,
    private fileService: FileService
  ) {}

  /////////////////////////////// ADMINER ///////////////////////////////
  public async adminerIsRunning(): Promise<boolean> {
    const dockerCommand = new DockerCommand();
    return dockerCommand.containerIsRunning(AdminerService.ADMINER_NAME);
  }

  public async startAdminerContainer(): Promise<boolean> {
    const taskName = 'Start adminer service';
    this.taskService.newTask(taskName);

    const dockerCommand = new DockerCommand();
    // check if the container exists
    const container = await dockerCommand.dockerInspect(AdminerService.ADMINER_NAME);

    if (container.isRunning()) {
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return true;
    }

    if (container.exists()) {
      // just start the container
      try {
        await dockerCommand.startContainer(AdminerService.ADMINER_NAME);
        this.taskService.markTaskAsSuccess(taskName, 'Ok');
        return true;
      } catch (e) {
        this.taskService.markTaskAsError(taskName, e.toString());
        throw e;
      }
    }

    try {
      const containerName = AdminerService.ADMINER_NAME;

      let labels: string[] = null;
      const ports: DockerRunOptionsPort[] = [];
      if (this.coreConfigService.isLocal()) {
        ports.push({ host: AdminerService.ADMINER_DESKTOP_PORT, container: 8080 });
      } else {
        const host = containerName + '.' + this.coreConfigService.getVirtualHost();
        labels = this.traefikService.getTraefikLabels(host, '8080', containerName);
      }

      const networks = [AdminerService.NETWORK_DEV, AdminerService.NETWORK_PROD];
      const result = await dockerCommand.dockerRun(AdminerService.ADMINER_IMAGE, containerName, {
        networks: networks,
        labels: labels,
        ports: ports,
      });
      this.taskService.markTaskAsSuccess(taskName, 'Ok');
      return result;
    } catch (e) {
      this.taskService.markTaskAsError(taskName, e.toString());
      throw e;
    }
  }

  // TODO TO FIX
  public async deleteAdminerContainer(): Promise<boolean> {
    return false;
    // return this.deleteContainer(AdminerService.ADMINER_NAME);
  }

  public async getAdminerInfo(): Promise<AdminerInfo> {
    let url: string;
    if (this.coreConfigService.isLocal()) {
      url = `http://localhost:${AdminerService.ADMINER_DESKTOP_PORT}`;
    } else {
      url = `https://${AdminerService.ADMINER_NAME}.${this.coreConfigService.getVirtualHost()}`;
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
