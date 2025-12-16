export enum BrickGWS {
  GWS_CORE = 'gws_core',
}

export enum BrickGWSTechnicalInfo {
  GWS_CORE_GLAB_VERSION = 'GLAB_VERSION',
  GWS_CORE_FRONT_VERSION = 'FRONT_VERSION',
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
