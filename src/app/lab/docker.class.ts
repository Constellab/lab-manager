export interface DockerPs {
  command: string;
  createdAt: string;
  id: string;
  image: string;
  mounts: string;
  names: string;
  networks: string;
  ports: string;
  runningFor: string;
  size: string;
  state: 'running' | 'exited';
  status: string;
}

export interface ComposeUpOptions{
  updateBricks?: boolean;
  updateContainers?: boolean
}
