import { DockerComposeStatusInfo } from './docker-compose-inspect.class';

export type DockerEnvironmentVariables = { [key: string]: string };

export interface RegisterComposeRequestDTO {
  compose_yaml_content: string;
  description: string;
  auto_start?: boolean;
  env?: DockerEnvironmentVariables;
}

export interface RegisterSQLDBComposeRequestDTO {
  username: string;
  password: string;
  database: string;
  description: string;
  auto_start?: boolean;
}

export interface RegisterSQLDBComposeResponseDTO {
  dbHost: string;
  status: DockerComposeStatusInfo;
}

export interface RegisterComposeFromZipRequestDTO {
  description: string;
  auto_start?: boolean;
  env?: DockerEnvironmentVariables;
}

export interface RegisterComposeConfig {
  description: string;
  autoStart?: boolean;
  envVariables?: DockerEnvironmentVariables;
}
