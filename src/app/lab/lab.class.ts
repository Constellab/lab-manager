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
  currentTask?: TaskStatusInfo;
  adminerIsRunning: boolean;
  labManagerVersion: string;
  biota: {
    exists: boolean;
    dbUrl ?: string;
  };
  labIsConfigured: boolean;
  labIsInitialized: boolean;
}

/**
 * Object to config the lab manager required on init
 */
export interface LabInitConfig {
  centralApiKey: string;
  codelabToken: string;
  centralFrontUrl: string;
  centralApiUrl: string;
  hubFrontUrl: string;
  gwsCoreProdPassword: string;
  gwsCoreDevPassword: string;
}