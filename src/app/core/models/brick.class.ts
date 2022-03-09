export type Brick = BrickPip | BrickGit;

interface BrickBase {
  name: string;
  repoType: 'PIP' | 'GIT';
  repo: string;
  version: string;
  isHidden: boolean,
}

export interface BrickPip extends BrickBase {
  repoType: 'PIP';
}

export interface BrickGit extends BrickBase {
  repoType: 'GIT';
  branch: string;
}

export enum BrickGWS{
  GWS_CORE = 'gws_core',
  GWS_BIOTA = 'gws_biota'
}