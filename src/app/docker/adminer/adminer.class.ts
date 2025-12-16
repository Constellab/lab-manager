export interface AdminerDbInfo {
  host: string;
  username: string;
  password: string;
  dbName: string;
}

export interface AdminerInfo {
  url: string;

  gwsCoreProd: AdminerDbInfo;
  gwsCoreDev: AdminerDbInfo;
}
