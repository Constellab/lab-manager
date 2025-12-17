import { MainComposeServiceName } from './compose/main-docker-compose.class';

// type for container state
export type DockerContainerState = 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'dead';

// type for container computed status
export type ContainerStatus = 'running' | 'stopped' | 'error' | 'none';

export type ContainerHealth = 'healthy' | 'unhealthy' | 'starting' | 'none';

export interface DockerPsFull {
  image: string;
  command: string;
  createdAt: string;
  id: string;
  mounts: string;
  names: string;
  networks: string;
  ports: string;
  runningFor: string;
  status: string;
}

// result of a simple docker inspect
export class DockerInspect {
  names: string;
  status: ContainerStatus;
  exitCode: number;
  image: string;
  startedAt: string;
  health: ContainerHealth;

  constructor(
    names: string,
    state: DockerContainerState | null,
    exitCode: string,
    image: string,
    startedAt: string,
    health: ContainerHealth
  ) {
    this.names = names;
    this.exitCode = parseInt(exitCode);
    this.image = image;
    this.startedAt = startedAt;
    this.health = health;

    this.status = this.convertStateToStatus(state, this.exitCode, this.names);
  }

  private convertStateToStatus(
    state: DockerContainerState,
    exitCode: number,
    names: string
  ): ContainerStatus {
    if (state == null) return 'none';
    if (state === 'running' || state == 'restarting') return 'running';
    if (state === 'created' || state === 'paused') return 'stopped';

    if (state === 'exited' || state === 'dead') {
      // specific case for codelab container, when its stop, it has the ExitCode 137
      // so we consider it as a normal stop
      if (names === MainComposeServiceName.CODELAB && exitCode === 137) exitCode = 0;
      if (exitCode === 0) {
        return 'stopped';
      } else {
        return 'error';
      }
    }

    return 'none';
  }

  public isRunning(): boolean {
    return this.status === 'running';
  }

  public isError(): boolean {
    return this.exitCode !== 0;
  }

  public exists(): boolean {
    return this.status !== 'none';
  }

  public isMariaDbOrMySql(): boolean {
    return this.image.toLowerCase().includes('mariadb') || this.image.toLowerCase().includes('mysql');
  }
}

export interface ComposeUpOptions {
  updateContainers?: boolean;
  services?: string[];
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

export interface DockerProgress {
  percent: number;
  message: string;
}

export interface ErrorLogs {
  mainErrors: string[];
  logs: string;
}

export interface DockerLogs {
  logs: string;
}

export interface StartLog {
  progress: DockerProgress | null;
  main_errors: string[];
  errors: string[];
}
