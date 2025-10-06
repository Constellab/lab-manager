import { existsSync, readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { DockerEnvironmentVariables } from './docker-compose.dto';
import {
  DockerComposeJson,
  DockerComposeVolume,
  DockerComposeVolumeVariable,
  DockerComposeYamlEnv,
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
  public static readonly LAB_VOLUME_HOST_VAR_NAME = '${LAB_VOLUME_HOST}';
  public static readonly CONTAINER_PREFIX = 'CONTAINER_PREFIX';
  public static readonly LAB_DOMAIN_VAR_NAME = 'LAB_DOMAIN';
  public static readonly X_HTTPS_LABELS = 'x-gws-https';
  public static readonly X_GWS_CONFIG = 'x-gws-config';

  constructor(
    strYaml: string,
    brickName: string | null,
    uniqueName: string | null,
    env: DockerComposeYamlEnv | null
  ) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml);
    this.content = this.checkYaml(yamlJson as DockerComposeJson, brickName, uniqueName, env);
  }

  private checkYaml(
    content: DockerComposeJson,
    brickName: string | null,
    uniqueName: string | null,
    env: DockerComposeYamlEnv | null
  ): DockerComposeJson {
    // check that the brickName and uniqueName match the ones in the file if provided
    if (brickName) {
      content['x-gws-brick-name'] = brickName;
    }

    if (uniqueName) {
      content['x-gws-unique-name'] = uniqueName;
    }

    if (env) {
      content['x-gws-env'] = env;
    }

    if (!content['x-gws-brick-name'] || content['x-gws-brick-name'].trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-gws-brick-name property');
    }
    if (!content['x-gws-unique-name'] || content['x-gws-unique-name'].trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-gws-unique-name property');
    }
    if (!content['x-gws-env']) {
      throw new Error('The docker-compose file is missing the x-gws-env property');
    }

    if (!content.services || Object.keys(content.services).length === 0) {
      throw new Error('The docker-compose file does not contain any services');
    }
    // check that all services have a container_name
    for (const serviceName of Object.keys(content.services)) {
      if (!content.services[serviceName].container_name) {
        throw new Error(`The service ${serviceName} is missing the container_name property`);
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
    env: DockerEnvironmentVariables | null
  ): void {
    this.replaceNetworkVariable();
    this.replaceVolumeVariable(volume);
    this.replaceXGwsConfig(systemEnv.labDomain);
    this.replaceEnvVariables({ [DockerComposeYaml.LAB_DOMAIN_VAR_NAME]: systemEnv.labDomain });
    if (env) {
      this.replaceEnvVariables(env);
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

  replaceContainerPrefix(): void {
    const brickName = this.getBrickName();
    const uniqueName = this.getUniqueName();
    let prefix = `${brickName}-${uniqueName}`;
    if (this.getEnv() === 'dev' || this.getEnv() === 'prod') {
      prefix = `${prefix}-${this.getEnv()}`;
    }

    this.replaceEnvVariables({ [DockerComposeYaml.CONTAINER_PREFIX]: prefix });
  }

  ////////////////////// ENV  //////////////////////
  addEnvironmentVariable(serviceName: string, envKey: string, envValue: string): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].environment) {
      this.content.services[serviceName].environment = [];
    }

    this.content.services[serviceName].environment.push(`${envKey}=${envValue}`);
  }

  ////////////////////// PORTS //////////////////////
  addPortMapping(serviceName: string, hostPort: number, containerPort: number): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].ports) {
      this.content.services[serviceName].ports = [];
    }

    this.content.services[serviceName].ports.push(`${hostPort}:${containerPort}`);
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
    if (this.content.services[serviceName].networks.includes(networkName)) {
      return;
    }
    this.content.services[serviceName].networks.push(networkName);

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
      this.content.services[serviceName].networks = this.content.services[serviceName].networks.filter(
        (net) => net !== networkName
      );
    }
  }

  /**
   * Parse the content to replace the custom properties and variables
   */
  public replaceNetworkVariable(): void {
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

    this.content.services[serviceName].volumes.push(`${hostPath}:${containerPath}`);
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
      this.content.volumes[volumeName] = {};
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
   * Replace the volume variable in the compose file
   * @param volume The volume variable to replace in the compose file
   */
  public replaceVolumeVariable(volume: DockerComposeVolumeVariable): void {
    // replace the networks variable names with actual network names
    // replace based on the context
    for (const serviceName of Object.keys(this.content.services)) {
      // replace the volume host path variable with actual path based on context
      const volumes = this.getServiceVolumes(serviceName);

      for (let i = 0; i < volumes.length; i++) {
        if (volumes[i].startsWith(DockerComposeYaml.LAB_VOLUME_HOST_VAR_NAME)) {
          if (volume.isNamed) {
            // replace the left part until the colon with the named volume
            const parts = volumes[i].split(':');
            volumes[i] = `${volume.hostVolume}:${parts[1].trim()}`;
            this.addNamedVolume(volume.hostVolume);
          } else {
            // determine which volume path to use based on context
            volumes[i] = volumes[i].replace(DockerComposeYaml.LAB_VOLUME_HOST_VAR_NAME, volume.hostVolume);
          }
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

    this.content.services[serviceName].labels.push(...labels);
  }

  addTraefikLabels(serviceName: string, host: string, servicePort: number): void {
    const labels = new TraefikLabels().addTraefikRouterLabels(host, servicePort, serviceName);
    this.addLabels(serviceName, labels.getLabels());
  }

  ///////////////////////// X GWS CONFIG ///////////////////////

  /**
   * In the x-gws-config section, replace the following custom label to traefik labels
   * x-gws-config:
   *   - x-gws-https:
   *       name: ragflow
   *       subDomain: ragflow
   *       internalPort: 80
   * @param labDomain
   */
  private replaceXGwsConfig(labDomain: string): void {
    for (const serviceName of Object.keys(this.content.services)) {
      const service = this.content.services[serviceName];

      // Check if service has x-gws-config
      if (!service[DockerComposeYaml.X_GWS_CONFIG]) {
        continue;
      }

      const gwsConfig = service[DockerComposeYaml.X_GWS_CONFIG];
      if (!Array.isArray(gwsConfig)) {
        continue;
      }

      // Initialize labels array if it doesn't exist
      if (!service.labels) {
        service.labels = [];
      }

      // Process each config item
      const traefikLabels = new TraefikLabels();
      for (const configItem of gwsConfig) {
        if (typeof configItem === 'object' && configItem !== null) {
          if (DockerComposeYaml.X_HTTPS_LABELS in configItem) {
            const httpsLabel = configItem[DockerComposeYaml.X_HTTPS_LABELS] as XHttpsLabel;
            const host = `${httpsLabel.subDomain}.${labDomain}`;
            traefikLabels.addTraefikDomainLabels(host, httpsLabel.internalPort, httpsLabel.name);
          }
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

      // Remove the x-gws-config after processing
      delete service[DockerComposeYaml.X_GWS_CONFIG];
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
    return this.content['x-gws-brick-name'];
  }

  getUniqueName(): string {
    return this.content['x-gws-unique-name'];
  }

  getDescription(): string | undefined {
    return this.content['x-gws-description'];
  }

  setDescription(description: string): void {
    this.content['x-gws-description'] = description;
  }

  getEnv(): DockerComposeYamlEnv {
    return this.content['x-gws-env'];
  }

  setEnv(env: DockerComposeYamlEnv): void {
    this.content['x-gws-env'] = env;
  }

  public static fromTemplateFile(
    filePath: string,
    brickName: string,
    uniqueName: string,
    env: DockerComposeYamlEnv
  ): DockerComposeYaml {
    if (!filePath || filePath.trim().length === 0) {
      throw new Error('The file path is empty');
    }
    if (!existsSync(filePath)) {
      throw new Error(`The file '${filePath}' does not exist`);
    }
    const fileContent = readFileSync(filePath, 'utf-8');
    return new DockerComposeYaml(fileContent, brickName, uniqueName, env);
  }

  public static fromFile(filePath: string): DockerComposeYaml {
    return DockerComposeYaml.fromTemplateFile(filePath, null, null, null);
  }
}
