export interface PrivateFile {
  version: number;
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
  };
  // contains some information about the current state of the lab
  // thoses information are kept when private.json is updated
  data: PrivateFileData;
}

export interface PrivateFileData {
  // store the current version of the biota db
  // can be different from the version of the biota version in config
  biota_current_db_url_version: string;

  // version of the manager that has been used to init the lab
  last_init_manager_version: string;
}

export function getPrivateFileTemplate(): PrivateFile {
  return {
    version: 1,
    central: {
      api_key: null,
      api_url: null,
      front_url: null,
    },
    hub: {
      front_url: null,
    },
    lab: {
      username: null,
      token: null,
    },
    db: {
      gws_core_prod_password: null,
      gws_core_dev_password: null,
    },
    data: {
      biota_current_db_url_version: null,
      last_init_manager_version: null,
    },
  };
}