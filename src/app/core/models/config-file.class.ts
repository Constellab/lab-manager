export interface ConfigFile {
  lab_id: string;
  name: string;
  front_version: string;
  glab_tag: 'latest' | 'beta' | string;
  biota_maria_db_url?: string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

export interface ConfigFileEnv {
  bricks: ConfigFileBrick[];
  variables: Record<string, string>;
}

export interface ConfigFileBrick{
  name: string;
  version: string;
}

