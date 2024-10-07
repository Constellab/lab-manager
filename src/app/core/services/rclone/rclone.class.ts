import { ChildProcess } from "child_process";
import { Observable } from "rxjs";

export interface RCloneFinalStatsDetail {
  bytes: number;
  errors: number;
  checks: number;
  transfers: number;
  elapsed: number;
  deleteErrors: number;
  deletes: number;
}

/**
 * RClone final stats object
 */
export interface RCloneFinalStats {
    level: string;
    message: string;
    source: string;
    stats: RCloneFinalStatsDetail;
    time: string;
  }
  
export type RCloneResult = {
    type: 'progress' | 'error',
    data: string,
  } | {
    type: 'finalStats',
    data: RCloneFinalStats
  };
  
  
export interface RCloneRespsonse {
    childProcess: ChildProcess;
    observable: Observable<RCloneResult>;
  }