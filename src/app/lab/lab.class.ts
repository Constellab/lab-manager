import { TaskStatusInfo } from '../core/models/task.class';
import { ContainersStatusInfo } from '../docker/docker-inspect.class';
import { ContainerStatus, DockerProgress } from '../docker/docker.class';

export type LabStatus = 'STOPPED' | 'RUNNING' | 'STARTING' | 'ERROR';

export class GlabStatus {
  status: ContainerStatus;
  startProgress: DockerProgress;
  hasStartError: boolean;
}

export interface LabManagerStatus {
  containersStatus: ContainersStatusInfo;
  currentTask?: TaskStatusInfo;
  adminerIsRunning: boolean;
  version: string;
  biota: {
    exists: boolean;
    dbUrl?: string;
  };
  isConfigured: boolean;
  isInitialized: boolean;
  // version of the lab manager that has been used to init the lab
  lastInitVersion: string;
  labFrontUrl: string;
  labStatus: LabStatus;
  glabStatus: GlabStatus;
}

/**
 * Object to config the lab manager required on init
 */
export interface LabInitConfig {
  space: {
    apiUrl: string;
    prodApiKey: string;
    devApiKey: string;
    frontUrl: string;
  };
  community: {
    apiUrl: string;
    apiKey: string;
    frontUrl: string;
  };
  codelabToken: string | null;
  gwsCoreProdPassword: string;
  gwsCoreDevPassword: string;
  labConfig: {
    enableBackup: boolean;
  };
  captchaSiteKey: string | null;
  openaiApiKey: string | null;
}
