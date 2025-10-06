export type DockerComposeYamlEnv = 'prod' | 'dev' | 'all' | 'none';

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

export interface DockerComposeVolumeVariable {
  hostVolume: string;
  isNamed: boolean;
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
}

export interface ComposeList {
  composes: ComposeInfo[];
}
