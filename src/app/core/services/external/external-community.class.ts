export enum BrickGWS {
  GWS_CORE = 'gws_core',
  GWS_BIOTA = 'gws_biota',
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
  brickName!: string;
  brickVersion!: string;
  repoType!: BrickRepositoryType;
  repositoryUrl!: string;
  // url to access the repository with the token
  repositoryAccessUrl!: string;
  technicalInfo?: Record<string, any>;
}

/**
 * Single brick lookup entry for the multiple-brick-info community route:
 * a brick name paired with the version the caller currently has.
 */
export class HnBrickInfoRequestDTO {
  name!: string;
  version!: string;
}

/**
 * Input DTO for the multiple-brick-info community route: a list of brick name/version pairs.
 */
export class HnMultipleBrickInfoInputDTO {
  bricks!: HnBrickInfoRequestDTO[];
}

/**
 * Response DTO with the summary info of a brick, including its latest
 * version and whether a newer version than the requested one exists.
 */
export class HnBrickInfoDTO {
  id!: string;
  name!: string;
  description!: string;
  imageLink!: string | null;
  lastVersion!: string;
  hasNewVersion!: boolean;
}
