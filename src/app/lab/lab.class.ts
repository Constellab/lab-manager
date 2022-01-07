import {TaskStatusInfo} from '../core/models/task.class';

/**
 * global status for the containers
 */
export type ContainersStatus = 'STOP' | 'DOWN' | 'UP' | 'PARTIALLY_UP';

export interface ContainerStatusInfo {
  status: ContainersStatus;
  info?: string;
}


export interface LabStatus {
  containersStatus: ContainerStatusInfo;
  currentTask ?: TaskStatusInfo;
}