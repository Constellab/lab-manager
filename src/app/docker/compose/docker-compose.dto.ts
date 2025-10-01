import { DockerComposeStatusInfo } from './docker-compose-inspect.class';

export type DockerEnvironmentVariables = { [key: string]: string };

export interface RegisterComposeRequestDTO {
  composeContent: string;
  description: string;
  env?: DockerEnvironmentVariables;
}

export interface RegisterSQLDBComposeRequestDTO {
  username: string;
  password: string;
  database: string;
  description: string;
}

export interface RegisterSQLDBComposeResponseDTO {
  dbHost: string;
  status: DockerComposeStatusInfo;
}

export interface RegisterComposeFromZipRequestDTO {
  description: string;
  env?: DockerEnvironmentVariables;
}
