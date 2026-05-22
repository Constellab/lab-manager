import { TaskStatusInfo } from '../core/models/task.class';
import { DockerComposeStatusInfo } from '../docker/compose/docker-compose-inspect.class';
import { ContainerStatus, DockerProgress } from '../docker/docker.class';

export type LabStatus = 'STOPPED' | 'RUNNING' | 'STARTING' | 'ERROR';

export class GlabStatus {
  status: ContainerStatus;
  startProgress: DockerProgress;
  hasStartError: boolean;
}

export interface LabManagerStatus {
  containersStatus: DockerComposeStatusInfo;
  currentTask?: TaskStatusInfo;
  adminerIsRunning: boolean;
  version: string;
  isConfigured: boolean;
  isInitialized: boolean;
  // version of the lab manager that has been used to init the lab
  lastInitVersion: string;
  labFrontUrl: string;
  codelabFrontUrl: string;
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
  lab: {
    id: string;
    name: string;
    codelabToken: string | null;
    captchaSiteKey: string | null;
  };
  db: {
    gwsCoreProdPassword: string;
    gwsCoreDevPassword: string;
  };
  backup: {
    enable: boolean;
  };
  openaiApiKey: string | null;
}
