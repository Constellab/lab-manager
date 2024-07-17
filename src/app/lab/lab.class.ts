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
    apiKey: string;
    frontUrl: string;
    apiUrl: string;
  },
  community: {
    frontUrl: string;
    apiUrl: string;
    apiKey: string;
  },
  codelabToken: string;
  gwsCoreProdPassword: string;
  gwsCoreDevPassword: string;
  dockerRegistry: {
    url: string;
    username: string;
    password: string;
  }
  labConfig: {
    enableBackup: boolean;
  }
  captchaSiteKey: string;
  openaiApiKey: string;
  /**
   * Provided for on premise installations. Can be used to add additional hosts to the lab manager
   * to enable access to apps from other domains.
   */
  additionalDomains?: string[];
}