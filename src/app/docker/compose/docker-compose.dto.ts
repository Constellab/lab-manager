import { DockerComposeStatusInfo } from './docker-compose-inspect.class';

export type DockerEnvironmentVariables = { [key: string]: string };

export interface RegisterComposeRequestOptionsDTO {
  description: string;
  auto_start?: boolean;
  environment_variables?: DockerEnvironmentVariables;
}

export interface RegisterComposeRequestDTO {
  compose_yaml_content: string;
  options: RegisterComposeRequestOptionsDTO;
}

export interface RegisterSQLDBComposeRequestOptionsDTO extends RegisterComposeRequestOptionsDTO {
  /**
   * If true, the volume will be placed in a non-backed-up location
   */
  disable_volume_backup?: boolean;
  /**
   * If true, the SQLDB compose will be connected to both prod and dev networks
   */
  all_environments_networks?: boolean;
  /**
   * Volume directory for the database data (inside the lab volume)
   */
  volume_sub_directory?: string;
}

export interface RegisterSQLDBComposeRequestDTO {
  username: string;
  password: string;
  database: string;
  options: RegisterSQLDBComposeRequestOptionsDTO;
}

export interface RegisterSQLDBComposeResponseDTO {
  dbHost: string;
  status: DockerComposeStatusInfo;
}

export interface RegisterComposeConfig {
  description: string;
  autoStart?: boolean;
  envVariables?: DockerEnvironmentVariables;
}
