export interface PrivateFile {
  version: number;
  central: {
    api_key: string;
    api_url: string;
    front_url: string;
  };
  community: {
    front_url: string;
    api_url: string;
    api_key: string;
  };
  lab: {
    username: string;
    token: string;
    hashToken: string;
    captchaSiteKey: string;
  };
  db: {
    gws_core_prod_password: string;
    gws_core_dev_password: string;
  };
  // registry info on how to pull images
  docker_registry: {
    url: string;
    username: string;
    password: string;
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
    community: {
      front_url: null,
      api_url: null,
      api_key: null,
    },
    lab: {
      username: 'codelab',
      token: null,
      hashToken: null,
    },
    db: {
      gws_core_prod_password: null,
      gws_core_dev_password: null,
    },
    docker_registry: {
      url: null,
      username: null,
      password: null,
    },
    data: {
      biota_current_db_url_version: null,
      last_init_manager_version: null,
    },
  };
}