export interface ConfigFile {
  lab_id: string;
  name: string;
  front_version: string;
  glab_tag: 'latest' | 'beta' | string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

export interface ConfigFileEnv {
  bricks: ConfigFileBrick[];
  variables: Record<string, string>;
}

export interface ConfigFileBrick {
  name: string;
  version: string;
}

/**
 * Simplified config with only glab and brick versions
 */
export interface BrickConfigsDTO {
  brickVersions: ConfigFileBrick[];
}

export interface LabManagerCleanDTO {
  removeErrorSubComposes: boolean;
  pruneSystem: boolean;
}
