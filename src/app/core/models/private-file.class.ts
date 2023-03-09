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
    gws_core_prod_password: string;
    gws_core_dev_password: string;
    // store the current version of the biota db
    // can be different from the version of the biota version in config
    biota_current_db_url_version: string;
  };
}
