/**
 * Interface for the public methods of the DockerCommandService to be able to create
 * a similar Mock for tests
 */
export interface DockerCommandServiceI {

  composeUp(options?: string[]): Promise<string>;

  composeDown(): Promise<string>;

  dockerPs(): Promise<string>;

  getLogs(containerName: string): Promise<string>

  login(username: string, password: string, registryUrl: string): Promise<string>;
}