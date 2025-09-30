import { existsSync, readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { TraefikService } from '../../core/services/traefik/traefik.service';

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

/**
 * Class to manipulate docker-compose.yml files
 */
export class DockerComposeYaml {
  content: DockerComposeJson;

  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly NETWORK_DEV_VAR_NAME = 'DEV';
  public static readonly NETWORK_PROD_VAR_NAME = 'PROD';

  constructor(strYaml: string, brickName?: string, uniqueName?: string) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml);
    const content = this.checkYaml(yamlJson as DockerComposeJson, brickName, uniqueName);
    this.content = this.parseYaml(content);
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

  /**
   * Parse the content to replace the custom properties and variables
   * @param content
   */
  private parseYaml(content: DockerComposeJson): DockerComposeJson {
    // replace the networks variable names with actual network names
    let hasDevNetwork = false;
    let hasProdNetwork = false;
    for (const serviceName of Object.keys(content.services)) {
      const service = content.services[serviceName];
      if (service.networks && service.networks.length > 0) {
        service.networks = service.networks.map((network) => {
          if (network === DockerComposeYaml.NETWORK_DEV_VAR_NAME) {
            hasDevNetwork = true;
            return DockerComposeYaml.NETWORK_DEV;
          } else if (network === DockerComposeYaml.NETWORK_PROD_VAR_NAME) {
            hasProdNetwork = true;
            return DockerComposeYaml.NETWORK_PROD;
          } else {
            return network;
          }
        });
      }
    }

    // loop through global networks and define them if not defined
    if (!content.networks) {
      content.networks = {};
    }
    if (hasDevNetwork) {
      content.networks[DockerComposeYaml.NETWORK_DEV] = { external: true };
    }
    if (hasProdNetwork) {
      content.networks[DockerComposeYaml.NETWORK_PROD] = { external: true };
    }

    return content;
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

    if (!this.content.networks) {
      this.content.networks = {};
    }

    if (!this.content.networks[networkName]) {
      this.content.networks[networkName] = external ? { external: true } : {};
    }
  }

  ///////////////////////// VOLUME ///////////////////////

  addVolume(serviceName: string, hostPath: string, containerPath: string): void {
    this.checkServiceExists(serviceName);
    if (!this.content.services[serviceName].volumes) {
      this.content.services[serviceName].volumes = [];
    }

    this.content.services[serviceName].volumes.push(`${hostPath}:${containerPath}`);
  }

  addNamedVolume(serviceName: string, volumeName: string, containerPath: string): void {
    this.checkServiceExists(serviceName);
    if (!this.content.volumes) {
      this.content.volumes = {};
    }

    if (!this.content.volumes[volumeName]) {
      this.content.volumes[volumeName] = {};
    }

    this.addVolume(serviceName, volumeName, containerPath);
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
