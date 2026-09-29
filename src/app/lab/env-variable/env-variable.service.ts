import { BadRequestException, Injectable } from '@nestjs/common';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { GPUService } from '../../core/services/gpu/gpu.service';
import { TaskService } from '../../core/services/task/task.service';
import { ConfigFile } from '../../core/models/config-file.class';
import { PrivateFile } from '../../core/models/private-file.class';
import { FileService } from '../../core/services/file/file.service';
import { getUrlHost } from '../../core/utils/url';

/**
 * Space domains allowed in the lab front CSP (connect-src and media-src), as space separated
 * CSP host sources. The Space sends them; a private.json written by an older Space, or by the
 * standalone front, does not have them, so they are derived from the space urls instead.
 * Empty when nothing is known: the lab front then keeps its own defaults.
 */
export function getCspAllowedDomains(privateJson: PrivateFile): string {
  if (privateJson.space?.cspAllowedDomains) {
    return privateJson.space.cspAllowedDomains;
  }
  const hosts = [getUrlHost(privateJson.space?.frontUrl), getUrlHost(privateJson.space?.apiUrl)];
  return [...new Set(hosts.filter((host) => host))].join(' ');
}

/**
 * Community domain allowed in the lab front CSP (connect-src, plainly and as wss://), a single
 * CSP host source. Same fallback as getCspAllowedDomains, from the community api url.
 */
export function getCommunityCspAllowedDomain(privateJson: PrivateFile): string {
  return privateJson.community?.cspAllowedDomain || getUrlHost(privateJson.community?.apiUrl);
}

/**
 * Simple class to generate the env variable string
 */
class EnvVariables {
  envString: string = '';

  public addEnvVariable(key: string, value: string): void {
    if (value == null) value = '';
    this.envString += `${key}="${value}"\n`;
  }

  public toString(): string {
    // replace all '$' by '$$' to escape them
    return this.envString.replace(/\$/g, '$$$$');
  }
}

@Injectable()
export class EnvVariableService {
  constructor(
    private fileService: FileService,
    private gpuService: GPUService,
    private taskService: TaskService,
    private coreConfigService: CoreConfigService
  ) {}

  /**
   * Set all the env variable necessary for the docker-compose file
   */
  public async setAllEnvVariables(configJson: ConfigFile, privateJson: PrivateFile): Promise<void> {
    const taskName = 'Configure lab manager';
    await this.taskService.newTask(taskName, 'Initializing env variable');

    try {
      const envVariables = new EnvVariables();

      if (configJson == null) {
        throw new BadRequestException('The config was not provided. Was the lab configured ?');
      }

      if (privateJson == null) {
        throw new BadRequestException('The private file was not provided. Was the lab initiliazed ?');
      }

      // FROM CONFIG
      envVariables.addEnvVariable('LAB_ID', privateJson.lab.id);
      envVariables.addEnvVariable('LAB_NAME', privateJson.lab.name);
      envVariables.addEnvVariable('LAB_MODE', 'prod');

      const labEnvironment = this.coreConfigService.isLocal() ? 'DESKTOP' : 'ON_CLOUD';
      envVariables.addEnvVariable('LAB_ENVIRONMENT', labEnvironment);

      // FRONT VERSION
      envVariables.addEnvVariable('FRONT_VERSION', configJson.front_version);

      // GLAB TAG
      envVariables.addEnvVariable('GLAB_TAG', configJson.glab_tag);

      envVariables.addEnvVariable('SPACE_PROD_API_KEY', privateJson.space.prodApiKey);
      envVariables.addEnvVariable('SPACE_DEV_API_KEY', privateJson.space.devApiKey);
      envVariables.addEnvVariable('SPACE_API_URL', privateJson.space.apiUrl);
      envVariables.addEnvVariable('SPACE_FRONT_URL', privateJson.space.frontUrl);

      if (privateJson.community) {
        envVariables.addEnvVariable('COMMUNITY_FRONT_URL', privateJson.community.frontUrl);
        envVariables.addEnvVariable('COMMUNITY_API_URL', privateJson.community.apiUrl);
      }

      // CONTENT SECURITY POLICY of the lab front, on top of the lab own domain (VIRTUAL_HOST)
      envVariables.addEnvVariable('CSP_ALLOWED_DOMAINS', getCspAllowedDomains(privateJson));
      envVariables.addEnvVariable('COMMUNITY_CSP_ALLOWED_DOMAIN', getCommunityCspAllowedDomain(privateJson));

      envVariables.addEnvVariable('GWS_CORE_PROD_DB_PASSWORD', privateJson.db.gwsCoreProdPassword);
      envVariables.addEnvVariable('GWS_CORE_DEV_DB_PASSWORD', privateJson.db.gwsCoreDevPassword);

      if (privateJson.lab.codelabHashToken) {
        envVariables.addEnvVariable(
          'HT_PASSWD',
          `${privateJson.lab.codelabUsername}:${privateJson.lab.codelabHashToken}`
        );
      }

      // OTHERS
      const isGpu: boolean = await this.gpuService.isGpu();
      envVariables.addEnvVariable('GPU', isGpu ? 'cuda' : '');
      // set the TAG_PREFIX to use the correct image based on if GPU is on
      envVariables.addEnvVariable('TAG_PREFIX', isGpu ? 'gpu-' : '');

      // CAPTCHA
      envVariables.addEnvVariable('CAPTCHA_SITE_KEY', privateJson.lab.captchaSiteKey);

      // OPEN AI KEY
      envVariables.addEnvVariable('OPENAI_API_KEY', privateJson.openaiApiKey);

      // write the env variables to the .env file
      this.fileService.updateEnvFile(envVariables.toString());

      // Custom user vars (e.g. GWS_MCP_SERVER_ENABLED) go to a SEPARATE file that
      // the glab service reads via `env_file:` (literal injection, no ${}
      // interpolation). Written WITHOUT the $$ escaping that EnvVariables.toString()
      // applies for the --env-file interpolation path, so values containing '$'
      // survive intact.
      const customVarsLines = Object.entries(configJson.variables ?? {})
        .map(([key, value]) => `${key}="${value ?? ''}"`)
        .join('\n');
      this.fileService.updateCustomVarsFile(customVarsLines ? customVarsLines + '\n' : '');

      this.taskService.markTaskAsSuccess(taskName, 'Env variables set');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.taskService.markTaskAsError(taskName, `Error while setting env variables: ${message}`);
      throw error;
    }
  }
}
