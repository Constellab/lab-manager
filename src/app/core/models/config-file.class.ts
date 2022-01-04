export interface ConfigFile {
  name: string;
  title: string;
  description: string;
  app_dir: string;
  virtual_host: string;
  uri: string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

export interface ConfigFileEnv {
  pip: ConfigFileEnvPip[];
  git: ConfigFileEnvGit[];
  variables: Record<string, string>;
}

export interface ConfigFileEnvPip {
  source: string;
  packages: ConfigFileEnvPipPackage[];
}

export interface ConfigFileEnvPipPackage {
  name: string;
  version: string; // version supported by pip, can be empty, ==2.0 or >=2.1
  is_brick: boolean;
}


export interface ConfigFileEnvGit {
  source: string;
  packages: ConfigFileEnvGitPackage[];
}

export interface ConfigFileEnvGitPackage {
  name: string;
  branch: string;
  commit: 'latest' | string;
  is_brick: boolean;
}
