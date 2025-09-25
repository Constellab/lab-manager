import { dump, load } from 'js-yaml';

// TODO TO REMOVE
export enum ComposeServiceName {
  GLAB = 'glab',
  CODELAB = 'codelab',
  FRONT = 'front',
  GWS_CORE_PROD_DB = 'gws_core_prod_db',
  GWS_CORE_DEV_DB = 'gws_core_dev_db',
  TEST_GWS_DEV_DB = 'test_gws_dev_db',
  GWS_BIOTA_DB = 'gws_biota_db',
}

export interface ComposeService {
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

export interface ComposeContent {
  services: Record<ComposeServiceName, ComposeService>;
  networks: Record<string, unknown>;
  volumes: Record<string, unknown>;
}

export class ComposeYaml {
  content: ComposeContent;

  constructor(strYaml: string) {
    if (!strYaml || strYaml.trim().length === 0) {
      throw new Error('The docker-compose.yml content is empty');
    }
    const yamlJson = load(strYaml);
    const content = yamlJson as ComposeContent;
    this.checkYaml(content);
    this.content = content;
  }

  private checkYaml(content: ComposeContent): void {
    // check that all services have a container_name
    for (const serviceName of Object.keys(content.services)) {
      if (!content.services[serviceName].container_name) {
        throw new Error(`The service ${serviceName} is missing the container_name property`);
      }
    }
  }

  addLabels(serviceName: string, labels: string[]): void {
    if (!this.content.services[serviceName].labels) {
      this.content.services[serviceName].labels = [];
    }

    this.content.services[serviceName].labels.push(...labels);
  }

  addEnvironmentVariable(serviceName: string, envKey: string, envValue: string): void {
    if (!this.content.services[serviceName].environment) {
      this.content.services[serviceName].environment = [];
    }

    this.content.services[serviceName].environment.push(`${envKey}=${envValue}`);
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
}
