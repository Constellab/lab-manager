export interface PrivateFile {
  central: {
    api_key: string;
    api_url: string;
    front_url: string;
  };
  hub: {
    front_url: string;
  };
  lab: {
    username: string;
    token: string;
  };
  db: {
    gws_biota_sqlite3db_url: string;
    gws_biota_mariadb_url: string;
    testdata_url: string;
    opendata_url: string;
    opendata_biodata_url: string;
    opendata_glove_url: string;
  };
}
