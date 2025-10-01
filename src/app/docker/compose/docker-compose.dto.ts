import { DockerComposeStatusInfo } from './docker-compose-inspect.class';

export interface RegisterComposeRequestDTO {
  composeContent: string;
  description: string;
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
}
