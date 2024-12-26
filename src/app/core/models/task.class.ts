/**
 * Status for the lab manager tasks
 */
export type TaskStatus = 'RUNNING' | 'SUCCESS' | 'ERROR';

export interface TaskStatusInfo {
  name: string;
  status: TaskStatus;
  info?: string;
}
