export interface DockerPs {
  Command: string;
  CreatedAt: string;
  ID: string;
  Image: string;
  Labels: string;
  LocalVolumes: string;
  Mounts: string;
  Names: string;
  Networks: string;
  Ports: string;
  RunningFor: string;
  Size: string;
  State: 'running' | 'exited';
  Status: string;
}

export interface ComposeUpOptions{
  updateBricks?: boolean;
}
