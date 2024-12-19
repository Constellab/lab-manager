export interface DockerPs {
  names: string;
  /**
   * The status of the container
   * running: The container is running
   * exited: The container is stopped
   * none: The container does not exist
   */
  state: 'running' | 'exited' | 'none';
}

export interface DockerPsWithImage extends DockerPs {
  image: string;
}

export interface DockerPsFull extends DockerPsWithImage {
  command: string;
  createdAt: string;
  id: string;
  mounts: string;
  names: string;
  networks: string;
  ports: string;
  runningFor: string;
  state: 'running' | 'exited';
  status: string;
}

export interface ComposeUpOptions {
  updateContainers?: boolean;
  pruneSystem?: boolean;
  destroyContainers?: boolean; // if true container will be destroyed and recreated
}

export interface ComposeRestartOptions extends ComposeUpOptions {
  destroyContainers?: boolean; // if true container will be destroyed and recreated
}

export interface DockerRunOptionsPort {
  host: number;
  container: number;
}

export interface DockerRunOptions {
  networks?: string[];
  labels?: string[];
  ports?: DockerRunOptionsPort[];
  envs?: Record<string, string>;
}

export interface PullBiotaDbOptions {
  forceUpdate?: boolean;
}
