import { DockerComposeStatusInfo } from './docker-compose-inspect.class';

export type DockerComposeYamlEnv = 'prod' | 'dev' | 'all' | 'none';

/*
 * Object to uniquely identify a docker-compose instance
 */
export interface DockerComposeUniqueId {
  brickName: string;
  uniqueName: string;
  env: DockerComposeYamlEnv | null;
}

export interface DockerComposeServiceJson {
  image: string;
  container_name: string;
  build?: string;
  ports?: string[];
  volumes?: string[];
  environment?: string[];
  networks?: string[];
  depends_on?: string[];
  labels?: string[];
  'x-gws-config'?: XGwsServiceConfig[];
}

/**
 * Main configuration for the compose file (top-level x-gws-config)
 */
export interface XGwsMainConfig {
  brickName: string;
  uniqueName: string;
  env: DockerComposeYamlEnv;
  description?: string;
  autoStart?: boolean;
}

export interface DockerComposeVolumeDefinition {
  name?: string;
  driver?: string;
  driver_opts?: Record<string, unknown>;
}

export interface DockerComposeJson {
  'x-gws-config': XGwsMainConfig;
  services: Record<string, DockerComposeServiceJson>;
  networks: Record<string, unknown>;
  volumes: Record<string, DockerComposeVolumeDefinition>;
}

export interface DockerComposeVolume {
  hostPath: string;
  containerPath: string;
  isNamed: boolean;
}

export interface ComposeInfo {
  brickName: string;
  uniqueName: string;
  env: DockerComposeYamlEnv;
  composeFilePath: string;
  isSubCompose: boolean;
  description?: string;
  autoStart: boolean;
}

export interface ComposeList {
  composes: ComposeInfo[];
}

/**
 * Status for sub compose registration/unregistration processes
 */
export type SubComposeProcessStatus = 'RUNNING' | 'SUCCESS' | 'ERROR';

/**
 * Type of process being performed on a sub compose
 */
export type SubComposeProcessType = 'REGISTER' | 'UNREGISTER';

/**
 * Information about a running/finished process on a sub compose
 */
export interface SubComposeProcessInfo {
  processType: SubComposeProcessType;
  status: SubComposeProcessStatus;
  message: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Overall status of a sub compose, including any running process and the docker-compose status
 */
export interface ComposeStatus {
  subComposeProcess?: SubComposeProcessInfo;
  composeStatus: DockerComposeStatusInfo;
}

/////////////////// VARIABLES IN docker-compose.yml ///////////////////

export interface DockerComposeVolumeVariable {
  hostVolume: string;
  hostVolumeNoBackup: string;
  isNamed: boolean;
}

export interface XBackupExclude {
  pattern: string;
  volume: string;
}

export interface XHttpsLabel {
  name: string;
  subDomain: string;
  internalPort: number;

  /**
   * If set, when the lab domain is localhost, this port will be opened on the host
   * and mapped to the internalPort of the container
   * Default: internalPort
   */
  localhostHostPort?: number;
}

export interface XGwsServiceConfig {
  https?: XHttpsLabel;
  backupExclude?: XBackupExclude;
}
