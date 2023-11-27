import {DockerPsFull, DockerRunOptions} from '../../docker/docker.class';

/**
 * Interface for the public methods of the DockerCommandService to be able to create
 * a similar Mock for tests
 */

export interface DockerCommandServiceI {

  composeUp(options?: string[]): Promise<string>;

  composeDown(): Promise<string>;

  composePull(): Promise<string>;

  getContainerInfo(containerName: string): Promise<DockerPsFull>;

  getLogs(containerName: string): Promise<string>;

  login(username: string, password: string, registryUrl: string): Promise<string>;

  systemPrune(): Promise<string>;

  dockerRun(image: string, containerName: string, options?: DockerRunOptions): Promise<boolean>;
}