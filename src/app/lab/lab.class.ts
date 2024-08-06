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
  version: string;
  biota: {
    exists: boolean;
    dbUrl ?: string;
  };
  isConfigured: boolean;
  isInitialized: boolean;
  // version of the lab manager that has been used to init the lab
  lastInitVersion: string;
}

/**
 * Object to config the lab manager required on init
 */
export interface LabInitConfig {
  space: {
    apiUrl: string;
    apiKey: string;
    frontUrl: string;
  },
  community: {
    apiUrl: string;
    apiKey: string;
    frontUrl: string;
  },
  codelabToken: string;
  gwsCoreProdPassword: string;
  gwsCoreDevPassword: string;
  labConfig: {
    enableBackup: boolean;
  }
  captchaSiteKey: string;
  openaiApiKey: string;
}