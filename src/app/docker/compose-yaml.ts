import { load, dump } from 'js-yaml';

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
  build: string;
  ports: string[];
  volumes: string[];
  environment: string[];
  networks: string[];
  depends_on: string[];
  labels: string[];
}

export interface ComposeContent {
  services: Record<ComposeServiceName, ComposeService>;
}

export class ComposeYaml {
  content: ComposeContent;

  constructor(strYaml: string) {
    this.content = load(strYaml) as any;
  }

  addLabels(serviceName: ComposeServiceName, labels: string[]): void {
    if (!this.content.services[serviceName].labels) {
      this.content.services[serviceName].labels = [];
    }

    this.content.services[serviceName].labels.push(...labels);
  }

  addEnvironmentVariable(serviceName: ComposeServiceName, envKey: string, envValue: string): void {
    if (!this.content.services[serviceName].environment) {
      this.content.services[serviceName].environment = [];
    }

    this.content.services[serviceName].environment.push(`${envKey}=${envValue}`);
  }

  toString(): string {
    return dump(this.content, { lineWidth: -1, quotingType: "'" });
  }
}
