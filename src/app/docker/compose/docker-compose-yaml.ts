import { existsSync, readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { DockerEnvironmentVariables } from './docker-compose.dto';
import {
  DockerComposeJson,
  DockerComposeUniqueId,
  DockerComposeVolume,
  DockerComposeVolumeVariable,
  DockerComposeYamlEnv,
  XGwsMainConfig,
  XBackupExclude,
  XGwsServiceConfig,
  XHttpsLabel,
} from './docker-compose.types';
import { TraefikLabels } from './traefik.labels';

/**
 * Class to manipulate docker-compose.yml files
 */
export class DockerComposeYaml {
  content: DockerComposeJson;

  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly LAB_NETWORK_VAR_NAME = '${LAB_NETWORK}';
  public static readonly LAB_NETWORK_ALL_VAR_NAME = '${LAB_NETWORK_ALL}';
  public static readonly LAB_VOLUME_HOST_VAR_NAME = '${LAB_VOLUME_HOST}';
  public static readonly LAB_VOLUME_HOST_NO_BACKUP_VAR_NAME = '${LAB_VOLUME_HOST_NO_BACKUP}';
  public static readonly CONTAINER_PREFIX = 'CONTAINER_PREFIX';
  public static readonly LAB_DOMAIN_VAR_NAME = 'LAB_DOMAIN';
  public static readonly X_HTTPS_LABELS = 'https';
  public static readonly X_BACKUP_EXCLUDE = 'backupExclude';
  public static readonly X_GWS_CONFIG = 'x-gws-config';

  constructor(strYaml: string, composeId?: DockerComposeUniqueId | null) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml) as DockerComposeJson;

    // Initialize x-gws-config if it doesn't exist
    if (!yamlJson['x-gws-config']) {
      yamlJson['x-gws-config'] = {} as XGwsMainConfig;
    }

    if (composeId?.brickName) {
      yamlJson['x-gws-config'].brickName = composeId.brickName;
    }

    if (composeId?.uniqueName) {
      yamlJson['x-gws-config'].uniqueName = composeId.uniqueName;
    }

    if (composeId?.env) {
      yamlJson['x-gws-config'].env = composeId.env;
    }
    this.content = this.checkYaml(yamlJson);
  }

  private checkYaml(content: DockerComposeJson): DockerComposeJson {
    // check that the x-gws-config exists
    if (!content['x-gws-config']) {
      throw new Error('The docker-compose file is missing the x-gws-config property');
    }

    const config = content['x-gws-config'];

    // check that the brickName and uniqueName are in the config
    if (!config.brickName || config.brickName.trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-gws-config.brickName property');
    }
    if (!config.uniqueName || config.uniqueName.trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-gws-config.uniqueName property');
    }
    if (!config.env) {
      throw new Error('The docker-compose file is missing the x-gws-config.env property');
    }

    if (!content.services || Object.keys(content.services).length === 0) {
      throw new Error('The docker-compose file does not contain any services');
    }
    // check that all services have a container_name
    for (const serviceName of Object.keys(content.services)) {
      if (!content.services[serviceName].container_name) {
        throw new Error(`The service '${serviceName}' is missing the container_name property`);
      }
    }

    return content;
  }

  ////////////////////// VARIABLE  //////////////////////

  public parseVariables(
    volume: DockerComposeVolumeVariable,
    systemEnv: {
      labDomain: string;
    },
    envVariables: DockerEnvironmentVariables | null
  ): void {
    this.replaceNetworkVariable();
    this.replaceVolumeVariable(volume);
    this.replaceXGwsConfig(systemEnv.labDomain);

    const brickName = this.getBrickName();
    const uniqueName = this.getUniqueName();
    let containerPrefix = `${brickName}-${uniqueName}`;
    if (this.getEnv() === 'dev' || this.getEnv() === 'prod') {
      containerPrefix = `${containerPrefix}-${this.getEnv()}`;
    }

    this.replaceEnvVariables({
      [DockerComposeYaml.LAB_DOMAIN_VAR_NAME]: systemEnv.labDomain,
      [DockerComposeYaml.CONTAINER_PREFIX]: containerPrefix,
    });
    if (envVariables) {
      this.replaceEnvVariables(envVariables);
    }
  }

  ////////////////////// SERVICE  //////////////////////
  getContainerNames(): string[] {
    return Object.values(this.content.services).map((service) => service.container_name);
  }

  getServiceNames(): string[] {
    return Object.keys(this.content.services);
  }

  serviceExists(serviceName: string): boolean {
    return this.getServiceNames().includes(serviceName);
  }

  getContainerNameFromService(serviceName: string): string {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`The service ${serviceName} does not exist in the compose file`);
    }
    return this.content.services[serviceName].container_name;
  }

  private checkServiceExists(serviceName: string): void {
    if (!this.serviceExists(serviceName)) {
      throw new Error(`The service ${serviceName} does not exist in the compose file`);
    }
  }

  ////////////////////// ENV  //////////////////////
  addEnvironmentVariable(serviceName: string, envKey: string, envValue: string): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].environment) {
      this.content.services[serviceName].environment = [];
    }

    this.content.services[serviceName].environment!.push(`${envKey}=${envValue}`);
  }

  ////////////////////// PORTS //////////////////////
  addPortMapping(serviceName: string, hostPort: number, containerPort: number): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].ports) {
      this.content.services[serviceName].ports = [];
    }

    this.content.services[serviceName].ports!.push(`${hostPort}:${containerPort}`);
  }
  ////////////////////// NETWORKS //////////////////////

  addProdNetwork(serviceName: string): void {
    this.addNetwork(serviceName, DockerComposeYaml.NETWORK_PROD, true);
  }

  addDevNetwork(serviceName: string): void {
    this.addNetwork(serviceName, DockerComposeYaml.NETWORK_DEV, true);
  }

  addNetwork(serviceName: string, networkName: string, external: boolean): void {
    this.checkServiceExists(serviceName);

    if (!this.content.services[serviceName].networks) {
      this.content.services[serviceName].networks = [];
    }

    // check if the network already exists for the service
    if (this.content.services[serviceName].networks!.includes(networkName)) {
      return;
    }
    this.content.services[serviceName].networks!.push(networkName);

    this.addGlobalNetwork(networkName, external);
  }

  addGlobalNetwork(networkName: string, external: boolean): void {
    if (!this.content.networks) {
      this.content.networks = {};
    }

    if (!this.content.networks[networkName]) {
      this.content.networks[networkName] = external ? { external: true } : {};
    }
  }

  getServiceNetworks(serviceName: string): string[] {
    this.checkServiceExists(serviceName);
    return this.content.services[serviceName].networks || [];
  }

  private removeServiceNetwork(serviceName: string, networkName: string): void {
    this.checkServiceExists(serviceName);
    if (this.content.services[serviceName].networks) {
      this.content.services[serviceName].networks = this.content.services[serviceName].networks!.filter(
        (net) => net !== networkName
      );
    }
  }

  /**
   * Parse the content to replace the custom properties and variables
   */
  private replaceNetworkVariable(): void {
    // replace the networks variable names with actual network names
    // replace based on the context
    for (const serviceName of Object.keys(this.content.services)) {
      const networks = this.getServiceNetworks(serviceName);
      for (const net of networks) {
        if (net === DockerComposeYaml.LAB_NETWORK_VAR_NAME) {
          // remove the variable network
          this.removeServiceNetwork(serviceName, net);
          // add the actual network based on context
          if (this.getEnv() === 'prod' || this.getEnv() === 'all') {
            this.addProdNetwork(serviceName);
          }
          if (this.getEnv() === 'dev' || this.getEnv() === 'all') {
            this.addDevNetwork(serviceName);
          }
        } else if (net === DockerComposeYaml.LAB_NETWORK_ALL_VAR_NAME) {
          // remove the variable network
          this.removeServiceNetwork(serviceName, net);
          // add both prod and dev networks
          this.addProdNetwork(serviceName);
          this.addDevNetwork(serviceName);
        }
      }
    }
  }

  ///////////////////////// VOLUME ///////////////////////

  private getServiceVolumes(serviceName: string): string[] {
    this.checkServiceExists(serviceName);
    return this.content.services[serviceName].volumes || [];
  }

  addVolume(serviceName: string, hostPath: string, containerPath: string): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].volumes) {
      this.content.services[serviceName].volumes = [];
    }

    this.content.services[serviceName].volumes!.push(`${hostPath}:${containerPath}`);
  }

  addNamedVolumeToService(serviceName: string, volumeName: string, containerPath: string): void {
    this.checkServiceExists(serviceName);
    this.addNamedVolume(volumeName);
    this.addVolume(serviceName, volumeName, containerPath);
  }

  addNamedVolume(volumeName: string): void {
    if (!this.content.volumes) {
      this.content.volumes = {};
    }

    if (!this.content.volumes[volumeName]) {
      this.content.volumes[volumeName] = {
        name: volumeName,
      };
    }
  }

  getAllVolumes(): DockerComposeVolume[] {
    const volumes: DockerComposeVolume[] = [];
    for (const serviceName of this.getServiceNames()) {
      const serviceVolumes = this.getServiceVolumes(serviceName);
      for (const vol of serviceVolumes) {
        const parts = vol.split(':');
        if (parts.length === 2) {
          const hostPath = parts[0].trim();
          const containerPath = parts[1].trim();
          const isNamed = !hostPath.startsWith('/') && !hostPath.startsWith('.');
          if (!volumes.find((v) => v.hostPath === hostPath && v.containerPath === containerPath)) {
            volumes.push({ hostPath, containerPath, isNamed });
          }
        }
      }
    }
    return volumes;
  }

  /**
   * Helper method to replace a volume variable in a volume string
   * @param volumeString The volume string to process (e.g., "${LAB_VOLUME_HOST}/data:/app/data")
   * @param varName The variable name to replace (e.g., "${LAB_VOLUME_HOST}")
   * @param hostVolumePath The host volume path to use for replacement
   * @param isNamed Whether to use named volumes
   * @returns The processed volume string, or null if no replacement was made
   */
  private replaceVolumeVariableInString(
    volumeString: string,
    varName: string,
    hostVolumePath: string,
    isNamed: boolean
  ): string | null {
    if (!volumeString.startsWith(varName)) {
      return null;
    }

    if (isNamed) {
      // replace the left part until the colon with the named volume
      const parts = volumeString.split(':');
      const leftPart = parts[0].trim();

      // Extract subfolder(s) after variable
      // Example: ${VAR}/esdata01 -> esdata01
      // Example: ${VAR}/path/to/data -> path-to-data
      // Example: ${VAR} -> (no subfolder)
      let volumeName = hostVolumePath;
      const subfolderPath = leftPart.substring(varName.length);

      if (subfolderPath && subfolderPath.length > 0) {
        // Remove leading slash and replace remaining slashes with hyphens
        const subfolder = subfolderPath.replace(/^\//, '').replace(/\//g, '-');
        volumeName = `${hostVolumePath}-${subfolder}`;
      }

      this.addNamedVolume(volumeName);
      return `${volumeName}:${parts[1].trim()}`;
    } else {
      // determine which volume path to use based on context
      return volumeString.replace(varName, hostVolumePath);
    }
  }

  /**
   * Replace the volume variable in the compose file
   * @param volume The volume variable to replace in the compose file
   */
  private replaceVolumeVariable(volume: DockerComposeVolumeVariable): void {
    // replace the volume variable names with actual volume paths
    // replace based on the context
    for (const serviceName of Object.keys(this.content.services)) {
      // replace the volume host path variable with actual path based on context
      const volumes = this.getServiceVolumes(serviceName);

      for (let i = 0; i < volumes.length; i++) {
        // Handle LAB_VOLUME_HOST_NO_BACKUP first (more specific)
        let replacedVolume = this.replaceVolumeVariableInString(
          volumes[i],
          DockerComposeYaml.LAB_VOLUME_HOST_NO_BACKUP_VAR_NAME,
          volume.hostVolumeNoBackup,
          volume.isNamed
        );

        if (replacedVolume) {
          volumes[i] = replacedVolume;
          continue;
        }

        // Handle standard LAB_VOLUME_HOST
        replacedVolume = this.replaceVolumeVariableInString(
          volumes[i],
          DockerComposeYaml.LAB_VOLUME_HOST_VAR_NAME,
          volume.hostVolume,
          volume.isNamed
        );

        if (replacedVolume) {
          volumes[i] = replacedVolume;
        }
      }
    }
  }

  ///////////////////////// LABELS ///////////////////////
  addLabels(serviceName: string, labels: string[]): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].labels) {
      this.content.services[serviceName].labels = [];
    }

    this.content.services[serviceName].labels!.push(...labels);
  }

  addTraefikLabels(serviceName: string, host: string, servicePort: number): void {
    const labels = new TraefikLabels().addTraefikRouterLabels(host, servicePort, serviceName);
    this.addLabels(serviceName, labels.getLabels());
  }

  ///////////////////////// X GWS CONFIG ///////////////////////

  /**
   * Get the x-gws-config for a service as a merged object, or null if not present/invalid
   */
  getServiceGwsConfig(serviceName: string): XGwsServiceConfig | null {
    this.checkServiceExists(serviceName);
    const gwsConfig = this.content.services[serviceName][DockerComposeYaml.X_GWS_CONFIG];
    if (!gwsConfig || !Array.isArray(gwsConfig)) return null;

    const result: XGwsServiceConfig = {};
    for (const item of gwsConfig) {
      if (typeof item !== 'object' || item === null) continue;
      if (DockerComposeYaml.X_HTTPS_LABELS in item) {
        result.https = item[DockerComposeYaml.X_HTTPS_LABELS] as XHttpsLabel;
      }
      if (DockerComposeYaml.X_BACKUP_EXCLUDE in item) {
        result.backupExclude = item[DockerComposeYaml.X_BACKUP_EXCLUDE] as XBackupExclude;
      }
    }
    return result;
  }

  /**
   * In the x-gws-config section, replace the following custom label to traefik labels
   * x-gws-config:
   *   - https:
   *       name: ragflow
   *       subDomain: ragflow
   *       internalPort: 80
   * @param labDomain
   */
  private replaceXGwsConfig(labDomain: string): void {
    for (const serviceName of Object.keys(this.content.services)) {
      const service = this.content.services[serviceName];

      const gwsConfig = this.getServiceGwsConfig(serviceName);
      if (!gwsConfig) continue;

      // Initialize labels array if it doesn't exist
      if (!service.labels) {
        service.labels = [];
      }

      // Process config
      const traefikLabels = new TraefikLabels();
      if (gwsConfig.https) {
        const httpsLabel = gwsConfig.https;
        if (labDomain === 'localhost') {
          // in localhost we do not add traefik labels
          // but we open the port mapping to the host
          this.addPortMapping(
            serviceName,
            httpsLabel.localhostHostPort ?? httpsLabel.internalPort,
            httpsLabel.internalPort
          );
        } else {
          const host = `${httpsLabel.subDomain}.${labDomain}`;
          traefikLabels.addTraefikDomainLabels(host, httpsLabel.internalPort, httpsLabel.name);
        }
      }

      if (traefikLabels.hasLabels()) {
        let network: string | undefined;
        if (this.getEnv() === 'prod' || this.getEnv() === 'all') {
          network = DockerComposeYaml.NETWORK_PROD;
        } else if (this.getEnv() === 'dev') {
          network = DockerComposeYaml.NETWORK_DEV;
        }
        // Add generated labels to the service
        service.labels.push(...traefikLabels.getLabels(network));

        if (network) {
          this.addNetwork(serviceName, network, true);
        }
      }

    }
  }

  ///////////////////////// OTHER ///////////////////////

  public replaceEnvVariables(env: DockerEnvironmentVariables): void {
    let contentStr = this.toString();
    for (const [key, value] of Object.entries(env)) {
      const varName = `\${${key}}`;
      contentStr = contentStr.split(varName).join(value);
    }
    this.content = this.checkYaml(load(contentStr) as DockerComposeJson);
  }

  toString(): string {
    return dump(this.content, { lineWidth: -1, quotingType: "'" });
  }

  equalTo(other: DockerComposeYaml): boolean {
    return this.toString() === other.toString();
  }

  getBrickName(): string {
    return this.content['x-gws-config'].brickName;
  }

  getUniqueName(): string {
    return this.content['x-gws-config'].uniqueName;
  }

  getDescription(): string | undefined {
    return this.content['x-gws-config'].description;
  }

  getComposeId(): DockerComposeUniqueId {
    return {
      brickName: this.getBrickName(),
      uniqueName: this.getUniqueName(),
      env: this.getEnv(),
    };
  }

  setDescription(description: string): void {
    this.content['x-gws-config'].description = description;
  }

  getAutoStart(): boolean | undefined {
    return this.content['x-gws-config'].autoStart;
  }

  setAutoStart(autoStart: boolean): void {
    this.content['x-gws-config'].autoStart = autoStart;
  }

  /**
   * Collect backup exclude patterns from service-level x-gws-config entries.
   * Each backupExclude entry specifies a pattern and a container volume path.
   * The container path is resolved to the host volume subfolder so that the
   * pattern is relative to the extension's volume root.
   *
   * Example in docker-compose.yml:
   *   minio:
   *     volumes:
   *       - ${LAB_VOLUME_HOST}/minio_data:/data
   *     x-gws-config:
   *       - backupExclude:
   *           pattern: '.minio.sys/**'
   *           volume: /data
   *
   * This resolves to: 'minio_data/.minio.sys/**'
   */
  getBackupExcludePatterns(): string[] {
    const patterns: string[] = [];

    for (const serviceName of this.getServiceNames()) {
      const gwsConfig = this.getServiceGwsConfig(serviceName);
      if (!gwsConfig?.backupExclude) continue;

      const excludeConfig = gwsConfig.backupExclude;
      if (!excludeConfig.pattern || !excludeConfig.volume) continue;

      const hostSubfolder = this.resolveVolumeHostSubfolder(serviceName, excludeConfig.volume);
      if (hostSubfolder) {
        patterns.push(`${hostSubfolder}/${excludeConfig.pattern}`);
      }
    }

    return patterns;
  }

  /**
   * Find the host volume subfolder name for a given container path on a service.
   * e.g. for volume '/app/prod/data/extensions/gws_ai_toolkit/ragflow/minio_data:/data'
   * and containerPath '/data', returns 'minio_data'
   */
  private resolveVolumeHostSubfolder(serviceName: string, containerPath: string): string | null {
    const volumes = this.getServiceVolumes(serviceName);
    for (const vol of volumes) {
      const parts = vol.split(':');
      if (parts.length < 2) continue;

      if (parts[1].trim() === containerPath) {
        return parts[0].trim().split('/').pop() || null;
      }
    }
    return null;
  }

  getEnv(): DockerComposeYamlEnv {
    return this.content['x-gws-config'].env;
  }

  setEnv(env: DockerComposeYamlEnv): void {
    this.content['x-gws-config'].env = env;
  }

  public static fromTemplateFile(filePath: string, composeId: DockerComposeUniqueId): DockerComposeYaml {
    if (!filePath || filePath.trim().length === 0) {
      throw new Error('The file path is empty');
    }
    if (!existsSync(filePath)) {
      throw new Error(`The file '${filePath}' does not exist`);
    }
    const fileContent = readFileSync(filePath, 'utf-8');
    return new DockerComposeYaml(fileContent, composeId);
  }

  public static fromFile(filePath: string): DockerComposeYaml {
    return new DockerComposeYaml(readFileSync(filePath, 'utf-8'), null);
  }
}
