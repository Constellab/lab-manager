/**
 * Interface for the public methods of the DockerCommandService to be able to create
 * a similar Mock for tests
 */

export interface DockerCommandServiceI {

  composeUp(filePath?: string, options?: string[]): Promise<string>;

  composeDown(filePath?: string): Promise<string>;

  composePull(filePath: string): Promise<string>;

  dockerPs(): Promise<string>;

  getLogs(containerName: string): Promise<string>;

  login(username: string, password: string, registryUrl: string): Promise<string>;

  systemPrune(): Promise<string>;
}