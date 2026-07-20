export interface ConfigFile {
  front_version: string;
  glab_tag: 'latest' | 'beta' | string;
  variables: Record<string, string>;
  environment: ConfigFileEnv;
}

// Cross-repo contract with gws_core (Settings.MCP_SERVER_ENABLED_ENV_VAR).
// Stored inside ConfigFile.variables as the string "true"/"false".
export const MCP_SERVER_ENABLED_KEY = 'GWS_MCP_SERVER_ENABLED';

export interface McpConfigDTO {
  enabled: boolean;
}

export interface CustomEnvVariablesDTO {
  variables: Record<string, string>;
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
