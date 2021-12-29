export interface PrivateFile {
  central: {
    api_key: string;
    api_url: string;
  },
  lab: {
    token: string;
  },
  db: {
    gws_biota_sqlite3db_url: string;
    gws_biota_mariadb_url: string;
    testdata_url: string;
    opendata_url: string;
    opendata_biodata_url: string;
    opendata_glove_url: string;
  },
  git: {
    name: string;
    login: string;
    credentials: string;
    key: string;
  }
}
