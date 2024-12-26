/**
 * Object that represent the current global activity of a lab
 */
export class LabGlobalActivity {
  running_experiments: number;
  queued_experiments: number;
  last_activity: LabActivity;
}

export class LabActivity {
  user: any;
  activity_type: string;
  object_type: string;
  object_id: string;
  created_at: string;
}
