import { TaskStatusInfo } from '../core/models/task.class';
import { DockerComposeStatusInfo } from '../docker/compose/docker-compose-inspect.class';
import { ContainerStatus, DockerProgress } from '../docker/docker.class';

export type LabStatus = 'STOPPED' | 'RUNNING' | 'STARTING' | 'ERROR';

export class GlabStatus {
  status!: ContainerStatus;
  startProgress!: DockerProgress | null;
  hasStartError!: boolean;
}

export interface LabManagerStatus {
  containersStatus: DockerComposeStatusInfo;
  currentTask?: TaskStatusInfo;
  adminerIsRunning: boolean;
  version: string;
  isConfigured: boolean;
  isInitialized: boolean;
  // version of the lab manager that has been used to init the lab
  lastInitVersion: string | null;
  // true if the config was changed since the last restart (init) of the lab,
  // meaning the lab must be restarted to apply the new config
  needsRestart: boolean;
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
    // Space domains allowed in the lab front CSP, space separated CSP host sources.
    // Optional: an older Space does not send it, see EnvVariableService.
    cspAllowedDomains?: string;
  };
  community: {
    apiUrl: string;
    apiKey: string;
    frontUrl: string;
    // Community domain allowed in the lab front CSP (plainly and as wss://), a single
    // CSP host source. Optional, same as above.
    cspAllowedDomain?: string;
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
