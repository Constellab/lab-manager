import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getLocalCors(): CorsOptions {
  return {
    origin: [/^(.*)/], // use regex instead of simple '*'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: false,
  };
}

/**
 * CORS for private-cloud mode: the standalone front is served from
 * `lab-config.${virtualHost}` and calls the API on `lab-manager.${virtualHost}`,
 * so the two are cross-origin. Whitelist only that one origin.
 * Subdomain must stay in sync with LabStandaloneFrontComposeService.LAB_CONFIG_SUBDOMAIN.
 */
export function getPrivateCloudCors(virtualHost: string): CorsOptions {
  return {
    origin: `https://lab-config.${virtualHost}`,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: false,
  };
}
