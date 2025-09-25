import { DockerInspect } from './docker.class';

/**
 * global status for multiple containers
 */
export type ContainersStatus = 'STOP' | 'DOWN' | 'UP' | 'PARTIALLY_UP' | 'ERROR';

export interface ContainersStatusInfo {
  status: ContainersStatus;
  info?: string;
}

/**
 * Class to manage the containers of docker-compose
 */
export class ContainersInspect {
  private containers: DockerInspect[] = [];

  public addContainer(container: DockerInspect): void {
    this.containers.push(container);
  }

  public getContainersStatus(): ContainersStatusInfo {
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

  public getContainer(name: string): DockerInspect | undefined {
    return this.containers.find((container) => container.names === name);
  }

  public getContainers(): DockerInspect[] {
    return this.containers;
  }
}
