export interface RegisterComposeRequestDTO {
  composeContent: string;
  description: string;
}

export interface RegisterSQLDBComposeRequestDTO {
  host: string;
  username: string;
  password: string;
  database: string;
  description: string;
  env: 'prod' | 'dev' | 'test';
}
