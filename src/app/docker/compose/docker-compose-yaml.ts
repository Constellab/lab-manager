import { existsSync, readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { TraefikService } from '../../core/services/traefik/traefik.service';
import { DockerEnvironmentVariables } from './docker-compose.dto';

export interface DockerComposeServiceJson {
  image: string;
  container_name: string;
  build?: string;
  ports?: string[];
  volumes?: string[];
  environment?: string[];
  networks?: string[];
  depends_on?: string[];
  labels?: string[];
}

export interface DockerComposeJson {
  'x-brick-name': string;
  'x-unique-name': string;
  'x-description'?: string;
  services: Record<string, DockerComposeServiceJson>;
  networks: Record<string, unknown>;
  volumes: Record<string, unknown>;
}

export type DockerComposeYamlContext = 'prod' | 'dev' | 'all' | 'none';

export interface DockerComposeVolumeVariable {
  hostVolume: string;
  isNamed: boolean;
}

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

  constructor(strYaml: string, brickName?: string, uniqueName?: string) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml);
    this.content = this.checkYaml(yamlJson as DockerComposeJson, brickName, uniqueName);
  }

  private checkYaml(content: DockerComposeJson, brickName?: string, uniqueName?: string): DockerComposeJson {
    // check that the brickName and uniqueName match the ones in the file if provided
    if (brickName) {
      content['x-brick-name'] = brickName;
    }

    if (uniqueName) {
      content['x-unique-name'] = uniqueName;
    }

    if (!content['x-brick-name'] || content['x-brick-name'].trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-brick-name property');
    }
    if (!content['x-unique-name'] || content['x-unique-name'].trim().length === 0) {
      throw new Error('The docker-compose file is missing the x-unique-name property');
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

  /**
   * Parse the content to replace the custom properties and variables
   */
  public replaceNetworkVariable(context: DockerComposeYamlContext): void {
    // replace the networks variable names with actual network names
    // replace based on the context
    for (const serviceName of Object.keys(this.content.services)) {
      const networks = this.getServiceNetworks(serviceName);
      for (const net of networks) {
        if (net === DockerComposeYaml.LAB_NETWORK_VAR_NAME) {
          // remove the variable network
          this.removeServiceNetwork(serviceName, net);
          // add the actual network based on context
          if (context === 'prod' || context === 'all') {
            this.addProdNetwork(serviceName);
          }
          if (context === 'dev' || context === 'all') {
            this.addDevNetwork(serviceName);
          }
        }
      }
    }
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

  replaceContainerPrefix(context: DockerComposeYamlContext): void {
    const brickName = this.getBrickName();
    const uniqueName = this.getUniqueName();
    let prefix = `${brickName}-${uniqueName}`;
    if (context === 'dev' || context === 'prod') {
      prefix = `${prefix}-${context}`;
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

  ///////////////////////// VOLUME ///////////////////////

  getServiceVolumes(serviceName: string): string[] {
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

  ///////////////////////// LABELS ///////////////////////
  addLabels(serviceName: string, labels: string[]): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].labels) {
      this.content.services[serviceName].labels = [];
    }

    this.content.services[serviceName].labels.push(...labels);
  }

  addTraefikLabels(serviceName: string, host: string, servicePort: number): void {
    const labels = new TraefikService().getTraefikLabels(host, servicePort, serviceName);
    this.addLabels(serviceName, labels);
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
    return this.content['x-brick-name'];
  }

  getUniqueName(): string {
    return this.content['x-unique-name'];
  }

  getDescription(): string | undefined {
    return this.content['x-description'];
  }

  setDescription(description: string): void {
    this.content['x-description'] = description;
  }

  public static fromFile(filePath: string, brickName?: string, uniqueName?: string): DockerComposeYaml {
    if (!filePath || filePath.trim().length === 0) {
      throw new Error('The file path is empty');
    }
    if (!existsSync(filePath)) {
      throw new Error(`The file '${filePath}' does not exist`);
    }
    const fileContent = readFileSync(filePath, 'utf-8');
    return new DockerComposeYaml(fileContent, brickName, uniqueName);
  }
}
