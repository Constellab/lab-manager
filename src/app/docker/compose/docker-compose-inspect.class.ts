import { DockerInspect } from '../docker.class';

/**
 * global status for multiple containers
 */
export type DockerComposeStatus = 'STOP' | 'DOWN' | 'UP' | 'PARTIALLY_UP' | 'ERROR';

export interface DockerComposeStatusInfo {
  status: DockerComposeStatus;
  info?: string;
}

/**
 * Class to manage the containers of docker-compose
 */
export class DockerComposeInspect {
  private containers: DockerInspect[] = [];

  public addContainer(container: DockerInspect): void {
    this.containers.push(container);
  }

  public getStatus(): DockerComposeStatusInfo {
    // if one containers is error return error
    if (this.containers.some((container) => container.status === 'error')) {
      return {
        status: 'ERROR',
        info: 'One or more containers are in error state',
      };
    }

    // if all containers are running return up
    if (this.containers.every((container) => container.status === 'running')) {
      return {
        status: 'UP',
        info: 'All containers are running',
      };
    }

    // if all containers do not exist return down
    if (this.containers.every((container) => container.status === 'none')) {
      return {
        status: 'DOWN',
        info: 'The containers do not exist',
      };
    }

    // if all containers are stopped return stopped
    if (this.containers.every((container) => container.status === 'stopped')) {
      return {
        status: 'STOP',
        info: 'All containers are stopped',
      };
    }

    // otherwise return partially up
    return {
      status: 'PARTIALLY_UP',
      info: 'Containers are partially up',
    };
  }

  public async allContainersAreRunning(): Promise<boolean> {
    const status = this.getStatus();
    return status.status === 'UP';
  }

  public async allContainersAreStopped(): Promise<boolean> {
    const status = this.getStatus();
    return status.status === 'STOP' || status.status === 'DOWN';
  }

  public async oneContainerIsRunning(): Promise<boolean> {
    const status = this.getStatus();
    return status.status === 'UP' || status.status === 'PARTIALLY_UP';
  }

  public getContainer(name: string): DockerInspect | undefined {
    return this.containers.find((container) => container.names === name);
  }

  public getContainers(): DockerInspect[] {
    return this.containers;
  }
}
