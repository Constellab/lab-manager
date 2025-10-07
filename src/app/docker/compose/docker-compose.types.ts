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
  'x-gws-config'?: Record<string, unknown>[];
}

export interface DockerComposeJson {
  'x-brick-name': string;
  'x-unique-name': string;
  'x-env': DockerComposeYamlEnv;
  'x-description'?: string;
  services: Record<string, DockerComposeServiceJson>;
  networks: Record<string, unknown>;
  volumes: Record<string, unknown>;
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

/////////////////// VARIABLES IN docker-compose.yml ///////////////////

export interface DockerComposeVolumeVariable {
  hostVolume: string;
  isNamed: boolean;
}

export interface XHttpsLabel {
  name: string;
  subDomain: string;
  internalPort: number;
}
