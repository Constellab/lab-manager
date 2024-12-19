export enum BrickGWS {
  GWS_CORE = 'gws_core',
  GWS_BIOTA = 'gws_biota',
}

export enum BrickGWSTechnicalInfo {
  GWS_CORE_GLAB_VERSION = 'GLAB_VERSION',
  GWS_CORE_FRONT_VERSION = 'FRONT_VERSION',
  GWS_BIOTA_DB_URL = 'MARIA_DB_URL',
}

export enum BrickRepositoryType {
  PIP = 'PIP',
  GIT = 'GIT',
}

export class BrickVersionDTO {
  brickName: string;
  brickVersion: string;
  repoType: BrickRepositoryType;
  repositoryUrl: string;
  // url to access the repository with the token
  repositoryAccessUrl: string;
  technicalInfo?: Record<string, any>;
}
