export interface PrivateFile {
  version: number;
  space: {
    prodApiKey: string;
    devApiKey: string;
    apiUrl: string;
    frontUrl: string;
  };
  community: {
    frontUrl: string;
    apiUrl: string;
  };
  lab: {
    id: string;
    name: string;
    codelabUsername: string;
    codelabToken: string;
    codelabHashToken: string;
    captchaSiteKey: string;
  };
  backup: {
    enable: boolean;
  };
  db: {
    gwsCoreProdPassword: string;
    gwsCoreDevPassword: string;
  };
  openaiApiKey: string;
  // contains some information about the current state of the lab
  // thoses information are kept when private.json is updated
  data: PrivateFileData;
}

export interface PrivateFileData {
  // version of the manager that has been used to init the lab
  lastInitManagerVersion: string;
  // hash of config.json that was applied on the last successful init/restart.
  // Used to detect if the config was changed since the last restart.
  lastInitConfigHash: string;
  // whether the lab must be restarted for pending changes to take effect.
  // Set to true when the config/env variables change or when the manager was
  // updated to a new version; reset to false on the next lab start (init).
  needsRestart: boolean;
}

export function getPrivateFileTemplate(): PrivateFile {
  return {
    version: 1,
    space: {
      prodApiKey: '',
      devApiKey: '',
      apiUrl: '',
      frontUrl: '',
    },
    community: {
      frontUrl: '',
      apiUrl: '',
    },
    lab: {
      id: '',
      name: '',
      codelabUsername: 'codelab',
      codelabToken: '',
      codelabHashToken: '',
      captchaSiteKey: '',
    },
    backup: {
      enable: true,
    },
    db: {
      gwsCoreProdPassword: '',
      gwsCoreDevPassword: '',
    },
    data: {
      lastInitManagerVersion: '',
      lastInitConfigHash: '',
      needsRestart: false,
    },
    openaiApiKey: '',
  };
}
