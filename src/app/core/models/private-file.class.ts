export interface PrivateFile {
  version: number;
  space: {
    prod_api_key: string;
    dev_api_key: string;
    api_url: string;
    front_url: string;
  };
  community: {
    front_url: string;
    api_url: string;
    api_key: string;
  };
  lab: {
    codelabUsername: string;
    codelabToken: string;
    codelabHashToken: string;
    captchaSiteKey: string;
  };
  backup: {
    enable: boolean;
  };
  db: {
    gws_core_prod_password: string;
    gws_core_dev_password: string;
  };
  openai_api_key: string;
  // contains some information about the current state of the lab
  // thoses information are kept when private.json is updated
  data: PrivateFileData;
}

export interface PrivateFileData {
  // version of the manager that has been used to init the lab
  last_init_manager_version: string;
}

export function getPrivateFileTemplate(): PrivateFile {
  return {
    version: 1,
    space: {
      prod_api_key: null,
      dev_api_key: null,
      api_url: null,
      front_url: null,
    },
    community: {
      front_url: null,
      api_url: null,
      api_key: null,
    },
    lab: {
      codelabUsername: 'codelab',
      codelabToken: null,
      codelabHashToken: null,
      captchaSiteKey: null,
    },
    backup: {
      enable: true,
    },
    db: {
      gws_core_prod_password: null,
      gws_core_dev_password: null,
    },
    data: {
      last_init_manager_version: null,
    },
    openai_api_key: null,
  };
}
