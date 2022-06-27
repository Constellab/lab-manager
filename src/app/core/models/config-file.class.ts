import {Brick} from './brick.class';

export interface ConfigFile {
  name: string;
  title: string;
  description: string;
  app_dir: string;
  uri: string;
  front_version: string;
  biota_maria_db_url: string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

export interface ConfigFileEnv {
  pip: ConfigFileEnvPip[];
  git: ConfigFileEnvGit[];
  variables: Record<string, string>;
}

export type ConfigBrickPackage = ConfigFileEnvPipPackage | ConfigFileEnvGitPackage

export interface ConfigFileEnvPip {
  source: string;
  packages: ConfigFileEnvPipPackage[];
}

export interface ConfigFileEnvPipPackage {
  name: string;
  version: string; // version supported by pip, can be empty, ==2.0 or >=2.1
  is_brick: boolean;
  is_hidden: boolean;
}


export interface ConfigFileEnvGit {
  source: string;
  packages: ConfigFileEnvGitPackage[];
}

export interface ConfigFileEnvGitPackage {
  name: string;
  branch: string;
  is_brick: boolean;
  is_hidden: boolean;
  version: string;
}

/**
 * DTO used to update the config
 */
export interface UpdateConfigDTO {
  labName: string;
  frontVersion: string;
  biotaMariaDbUrl: string;
  bricks: SaveBrickDTO[];
}

export interface SaveBrickDTO {
  name: string;
  repo: string;
  repoType: 'PIP' | 'GIT';
  version: string;
  branch?: string;
  isHidden: boolean;
  technicalInfo: Record<string, string>;
}

export interface LabConfigDTO {
  bricks: Brick[];
}