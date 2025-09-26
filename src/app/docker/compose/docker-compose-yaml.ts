import { existsSync, readFileSync } from 'fs';
import { dump, load } from 'js-yaml';
import { TraefikService } from '../../core/services/traefik/traefik.service';

export interface DockerComposeService {
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

export interface DockerComposeContent {
  services: Record<string, DockerComposeService>;
  networks: Record<string, unknown>;
  volumes: Record<string, unknown>;
}

/**
 * Class to manipulate docker-compose.yml files
 */
export class DockerComposeYaml {
  content: DockerComposeContent;

  public static readonly NETWORK_DEV = 'gencovery-network-dev';
  public static readonly NETWORK_PROD = 'gencovery-network-prod';

  public static readonly NETWORK_DEV_VAR_NAME = 'DEV';
  public static readonly NETWORK_PROD_VAR_NAME = 'PROD';

  constructor(strYaml: string) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml);
    const content = yamlJson as DockerComposeContent;
    this.checkYaml(content);
    this.content = this.parseYaml(content);
  }

  private checkYaml(content: DockerComposeContent): void {
    // check that all services have a container_name
    for (const serviceName of Object.keys(content.services)) {
      if (!content.services[serviceName].container_name) {
        throw new Error(`The service ${serviceName} is missing the container_name property`);
      }
    }
  }

  /**
   * Parse the content to replace the custom properties and variables
   * @param content
   */
  private parseYaml(content: DockerComposeContent): DockerComposeContent {
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

  addLabels(serviceName: string, labels: string[]): void {
    if (!this.content.services[serviceName].labels) {
      this.content.services[serviceName].labels = [];
    }

    this.content.services[serviceName].labels.push(...labels);
  }

  addTraefikLabels(serviceName: string, host: string, servicePort: number): void {
    const labels = new TraefikService().getTraefikLabels(host, servicePort, serviceName);
    this.addLabels(serviceName, labels);
  }

  addEnvironmentVariable(serviceName: string, envKey: string, envValue: string): void {
    if (!this.content.services[serviceName].environment) {
      this.content.services[serviceName].environment = [];
    }

    this.content.services[serviceName].environment.push(`${envKey}=${envValue}`);
  }

  addPortMapping(serviceName: string, hostPort: number, containerPort: number): void {
    if (!this.content.services[serviceName].ports) {
      this.content.services[serviceName].ports = [];
    }

    this.content.services[serviceName].ports.push(`${hostPort}:${containerPort}`);
  }

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

  toString(): string {
    return dump(this.content, { lineWidth: -1, quotingType: "'" });
  }

  equalTo(other: DockerComposeYaml): boolean {
    return this.toString() === other.toString();
  }

  public static fromFile(filePath: string): DockerComposeYaml {
    if (!filePath || filePath.trim().length === 0) {
      throw new Error('The file path is empty');
    }
    if (!existsSync(filePath)) {
      throw new Error(`The file '${filePath}' does not exist`);
    }
    const fileContent = readFileSync(filePath, 'utf-8');
    return new DockerComposeYaml(fileContent);
  }
}
