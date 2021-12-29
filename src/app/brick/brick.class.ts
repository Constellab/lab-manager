export type Brick = BrickPip | BrickGit;

interface BrickBase {
  name: string;
  type: 'pip' | 'git';
  source: string;
}

export interface BrickPip extends BrickBase {
  type: 'pip';
  version: string;
}

export interface BrickGit extends BrickBase {
  type: 'git';
  branch: string;
  commit: string;
}