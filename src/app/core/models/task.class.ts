export enum TaskStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface TaskStatusInfo {
  name: string;
  status: TaskStatus;
  info?: string;
}