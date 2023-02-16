export interface ConfigFile {
  lab_id: string;
  name: string;
  front_version: string;
  glab_tag: 'latest' | 'beta' | string;
  biota_maria_db_url: string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

export interface ConfigFileEnv {
  pip: ConfigFileEnvRepository[];
  git: ConfigFileEnvRepository[];
  variables: Record<string, string>;
}

export interface ConfigFileEnvRepository {
  source: string;
  packages: ConfigFileEnvPackage[];
}

export interface ConfigFileEnvPackage {
  name: string;
  version: string; // version supported by pip, can be empty, ==2.0 or >=2.1
  is_brick: boolean;
  is_hidden: boolean;
}

