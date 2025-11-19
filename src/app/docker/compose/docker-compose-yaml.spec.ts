import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerComposeUniqueId } from './docker-compose.types';

describe('DockerComposeYaml', () => {
  const testDir = join(__dirname, 'test-temp');
  const testComposeFile = join(testDir, 'docker-compose.yml');

  // Sample compose content with x-gws-config
  const sampleComposeContent = `
x-gws-config:
  brickName: test-brick
  uniqueName: test-unique
  env: dev

services:
  test-service:
    image: nginx:latest
    container_name: test-container
    networks:
      - test-network
    volumes:
      - /test/volume:/data
    environment:
      - TEST_VAR=test_value
    labels:
      - test.label=true

networks:
  test-network:
    external: true
`;

  const minimalComposeContent = `
x-gws-config:
  brickName: minimal
  uniqueName: minimal-unique
  env: prod

services:
  minimal-service:
    image: alpine:latest
    container_name: minimal-container
`;

  const composeWithVariables = `
x-gws-config:
  brickName: var-brick
  uniqueName: var-unique
  env: all

services:
  var-service:
    image: nginx:latest
    container_name: \${CONTAINER_PREFIX}-nginx
    networks:
      - \${LAB_NETWORK}
    volumes:
      - \${LAB_VOLUME_HOST}:/data
      - \${LAB_VOLUME_HOST}/subdir:/data/subdir
    environment:
      - DOMAIN=\${LAB_DOMAIN}
`;

  const composeWithXGwsConfig = `
x-gws-config:
  brickName: traefik-brick
  uniqueName: traefik-unique
  env: prod

services:
  web-service:
    image: nginx:latest
    container_name: web-container
    x-gws-config:
      - https:
          name: webapp
          subDomain: myapp
          internalPort: 80
`;

  const composeWithXGwsConfigLocalhost = `
x-gws-config:
  brickName: local-brick
  uniqueName: local-unique
  env: dev

services:
  local-service:
    image: nginx:latest
    container_name: local-container
    x-gws-config:
      - https:
          name: localapp
          subDomain: local
          internalPort: 8080
          localhostHostPort: 9090
`;

  beforeAll(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Constructor', () => {
    it('should create instance from YAML string', () => {
      const compose = new DockerComposeYaml(sampleComposeContent, null);
      expect(compose).toBeDefined();
      expect(compose.getBrickName()).toBe('test-brick');
      expect(compose.getUniqueName()).toBe('test-unique');
      expect(compose.getEnv()).toBe('dev');
    });

    it('should override x-gws-config with provided composeId', () => {
      const composeId: DockerComposeUniqueId = {
        brickName: 'override-brick',
        uniqueName: 'override-unique',
        env: 'prod',
      };
      const compose = new DockerComposeYaml(sampleComposeContent, composeId);
      expect(compose.getBrickName()).toBe('override-brick');
      expect(compose.getUniqueName()).toBe('override-unique');
      expect(compose.getEnv()).toBe('prod');
    });

    it('should initialize x-gws-config if it does not exist', () => {
      const contentWithoutConfig = `
services:
  test-service:
    image: nginx:latest
    container_name: test-container
`;
      const composeId: DockerComposeUniqueId = {
        brickName: 'new-brick',
        uniqueName: 'new-unique',
        env: 'dev',
      };
      const compose = new DockerComposeYaml(contentWithoutConfig, composeId);
      expect(compose.getBrickName()).toBe('new-brick');
      expect(compose.getUniqueName()).toBe('new-unique');
      expect(compose.getEnv()).toBe('dev');
    });

    it('should throw error for empty content', () => {
      expect(() => new DockerComposeYaml('', null)).toThrow('The docker-compose.yml content is empty');
    });

    it('should throw error if x-gws-config is missing after initialization', () => {
      const contentWithoutConfig = `
services:
  test-service:
    image: nginx:latest
    container_name: test-container
`;
      // When no composeId is provided, x-gws-config is initialized but brickName will be missing
      expect(() => new DockerComposeYaml(contentWithoutConfig, null)).toThrow(
        'The docker-compose file is missing the x-gws-config.brickName property'
      );
    });

    it('should throw error if brickName is missing', () => {
      const invalidContent = `
x-gws-config:
  uniqueName: test-unique
  env: dev

services:
  test-service:
    image: nginx:latest
    container_name: test-container
`;
      expect(() => new DockerComposeYaml(invalidContent, null)).toThrow(
        'The docker-compose file is missing the x-gws-config.brickName property'
      );
    });

    it('should throw error if uniqueName is missing', () => {
      const invalidContent = `
x-gws-config:
  brickName: test-brick
  env: dev

services:
  test-service:
    image: nginx:latest
    container_name: test-container
`;
      expect(() => new DockerComposeYaml(invalidContent, null)).toThrow(
        'The docker-compose file is missing the x-gws-config.uniqueName property'
      );
    });

    it('should throw error if env is missing', () => {
      const invalidContent = `
x-gws-config:
  brickName: test-brick
  uniqueName: test-unique

services:
  test-service:
    image: nginx:latest
    container_name: test-container
`;
      expect(() => new DockerComposeYaml(invalidContent, null)).toThrow(
        'The docker-compose file is missing the x-gws-config.env property'
      );
    });

    it('should throw error if services are missing', () => {
      const invalidContent = `
x-gws-config:
  brickName: test-brick
  uniqueName: test-unique
  env: dev
`;
      expect(() => new DockerComposeYaml(invalidContent, null)).toThrow(
        'The docker-compose file does not contain any services'
      );
    });

    it('should throw error if a service is missing container_name', () => {
      const invalidContent = `
x-gws-config:
  brickName: test-brick
  uniqueName: test-unique
  env: dev

services:
  test-service:
    image: nginx:latest
`;
      expect(() => new DockerComposeYaml(invalidContent, null)).toThrow(
        "The service 'test-service' is missing the container_name property"
      );
    });
  });

  describe('Static factory methods', () => {
    beforeEach(() => {
      writeFileSync(testComposeFile, sampleComposeContent);
    });

    afterEach(() => {
      if (existsSync(testComposeFile)) {
        rmSync(testComposeFile);
      }
    });

    it('should create instance from template file with composeId', () => {
      const composeId: DockerComposeUniqueId = {
        brickName: 'template-brick',
        uniqueName: 'template-unique',
        env: 'prod',
      };
      const compose = DockerComposeYaml.fromTemplateFile(testComposeFile, composeId);
      expect(compose).toBeDefined();
      expect(compose.getBrickName()).toBe('template-brick');
      expect(compose.getUniqueName()).toBe('template-unique');
      expect(compose.getEnv()).toBe('prod');
    });

    it('should create instance from file without composeId', () => {
      const compose = DockerComposeYaml.fromFile(testComposeFile);
      expect(compose).toBeDefined();
      expect(compose.getBrickName()).toBe('test-brick');
      expect(compose.getUniqueName()).toBe('test-unique');
      expect(compose.getEnv()).toBe('dev');
    });

    it('should throw error if template file path is empty', () => {
      const composeId: DockerComposeUniqueId = {
        brickName: 'test-brick',
        uniqueName: 'test-unique',
        env: 'prod',
      };
      expect(() => DockerComposeYaml.fromTemplateFile('', composeId)).toThrow('The file path is empty');
    });

    it('should throw error if template file does not exist', () => {
      const composeId: DockerComposeUniqueId = {
        brickName: 'test-brick',
        uniqueName: 'test-unique',
        env: 'prod',
      };
      expect(() => DockerComposeYaml.fromTemplateFile('/nonexistent/file.yml', composeId)).toThrow(
        "The file '/nonexistent/file.yml' does not exist"
      );
    });
  });

  describe('Service operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(sampleComposeContent, null);
    });

    it('should get container names', () => {
      const containerNames = compose.getContainerNames();
      expect(containerNames).toEqual(['test-container']);
    });

    it('should get service names', () => {
      const serviceNames = compose.getServiceNames();
      expect(serviceNames).toEqual(['test-service']);
    });

    it('should check if service exists', () => {
      expect(compose.serviceExists('test-service')).toBe(true);
      expect(compose.serviceExists('nonexistent-service')).toBe(false);
    });

    it('should get container name from service', () => {
      const containerName = compose.getContainerNameFromService('test-service');
      expect(containerName).toBe('test-container');
    });

    it('should throw error when getting container name from nonexistent service', () => {
      expect(() => compose.getContainerNameFromService('nonexistent-service')).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });
  });

  describe('Environment variable operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(minimalComposeContent, null);
    });

    it('should add environment variable to existing service', () => {
      compose.addEnvironmentVariable('minimal-service', 'NEW_VAR', 'new_value');
      const service = compose.content.services['minimal-service'];
      expect(service.environment).toContain('NEW_VAR=new_value');
    });

    it('should throw error when adding environment variable to nonexistent service', () => {
      expect(() => compose.addEnvironmentVariable('nonexistent-service', 'VAR', 'value')).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });
  });

  describe('Port mapping operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(minimalComposeContent, null);
    });

    it('should add port mapping to service', () => {
      compose.addPortMapping('minimal-service', 8080, 80);
      const service = compose.content.services['minimal-service'];
      expect(service.ports).toContain('8080:80');
    });

    it('should throw error when adding port mapping to nonexistent service', () => {
      expect(() => compose.addPortMapping('nonexistent-service', 8080, 80)).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });
  });

  describe('Network operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(minimalComposeContent, null);
    });

    it('should add prod network to service', () => {
      compose.addProdNetwork('minimal-service');
      const networks = compose.getServiceNetworks('minimal-service');
      expect(networks).toContain(DockerComposeYaml.NETWORK_PROD);
      expect(compose.content.networks[DockerComposeYaml.NETWORK_PROD]).toEqual({ external: true });
    });

    it('should add dev network to service', () => {
      compose.addDevNetwork('minimal-service');
      const networks = compose.getServiceNetworks('minimal-service');
      expect(networks).toContain(DockerComposeYaml.NETWORK_DEV);
      expect(compose.content.networks[DockerComposeYaml.NETWORK_DEV]).toEqual({ external: true });
    });

    it('should add custom network to service', () => {
      compose.addNetwork('minimal-service', 'custom-network', false);
      const networks = compose.getServiceNetworks('minimal-service');
      expect(networks).toContain('custom-network');
      expect(compose.content.networks['custom-network']).toEqual({});
    });

    it('should not add duplicate network to service', () => {
      compose.addNetwork('minimal-service', 'test-network', true);
      compose.addNetwork('minimal-service', 'test-network', true);
      const networks = compose.getServiceNetworks('minimal-service');
      const count = networks.filter((n) => n === 'test-network').length;
      expect(count).toBe(1);
    });

    it('should throw error when adding network to nonexistent service', () => {
      expect(() => compose.addNetwork('nonexistent-service', 'test-network', true)).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });
  });

  describe('Volume operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(minimalComposeContent, null);
    });

    it('should add volume to service', () => {
      compose.addVolume('minimal-service', '/host/path', '/container/path');
      const service = compose.content.services['minimal-service'];
      expect(service.volumes).toContain('/host/path:/container/path');
    });

    it('should add named volume to service', () => {
      compose.addNamedVolumeToService('minimal-service', 'test-volume', '/data');
      const service = compose.content.services['minimal-service'];
      expect(service.volumes).toContain('test-volume:/data');
      expect(compose.content.volumes['test-volume']).toEqual({ name: 'test-volume' });
    });

    it('should get all volumes', () => {
      compose.addVolume('minimal-service', '/host/path', '/container/path');
      compose.addNamedVolumeToService('minimal-service', 'named-volume', '/data');
      const volumes = compose.getAllVolumes();
      expect(volumes).toHaveLength(2);
      expect(volumes[0]).toEqual({
        hostPath: '/host/path',
        containerPath: '/container/path',
        isNamed: false,
      });
      expect(volumes[1]).toEqual({
        hostPath: 'named-volume',
        containerPath: '/data',
        isNamed: true,
      });
    });

    it('should throw error when adding volume to nonexistent service', () => {
      expect(() => compose.addVolume('nonexistent-service', '/host', '/container')).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });

  describe('Label operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(minimalComposeContent, null);
    });

    it('should add labels to service', () => {
      compose.addLabels('minimal-service', ['label1=value1', 'label2=value2']);
      const service = compose.content.services['minimal-service'];
      expect(service.labels).toContain('label1=value1');
      expect(service.labels).toContain('label2=value2');
    });

    it('should add traefik labels to service', () => {
      compose.addTraefikLabels('minimal-service', 'test.example.com', 8080);
      const service = compose.content.services['minimal-service'];
      expect(service.labels).toBeDefined();
      expect(service.labels.length).toBeGreaterThan(0);
    });

    it('should throw error when adding labels to nonexistent service', () => {
      expect(() => compose.addLabels('nonexistent-service', ['label=value'])).toThrow(
        'The service nonexistent-service does not exist in the compose file'
      );
    });
  });

  describe('Variable parsing and replacement', () => {
    it('should replace network variable with prod network', () => {
      const compose = new DockerComposeYaml(composeWithVariables, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'example.com' },
        null
      );
      const networks = compose.getServiceNetworks('var-service');
      expect(networks).toContain(DockerComposeYaml.NETWORK_PROD);
      expect(networks).toContain(DockerComposeYaml.NETWORK_DEV);
      expect(networks).not.toContain(DockerComposeYaml.LAB_NETWORK_VAR_NAME);
    });

    it('should replace network variable with dev network for dev env', () => {
      const composeId: DockerComposeUniqueId = {
        brickName: 'var-brick',
        uniqueName: 'var-unique',
        env: 'dev',
      };
      const compose = new DockerComposeYaml(composeWithVariables, composeId);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'example.com' },
        null
      );
      const networks = compose.getServiceNetworks('var-service');
      expect(networks).toContain(DockerComposeYaml.NETWORK_DEV);
      expect(networks).not.toContain(DockerComposeYaml.NETWORK_PROD);
    });

    it('should replace volume variable with host path', () => {
      const compose = new DockerComposeYaml(composeWithVariables, null);
      compose.parseVariables(
        { hostVolume: '/actual/host/path', isNamed: false },
        { labDomain: 'example.com' },
        null
      );
      const service = compose.content.services['var-service'];
      expect(service.volumes).toContain('/actual/host/path:/data');
      expect(service.volumes).toContain('/actual/host/path/subdir:/data/subdir');
    });

    it('should replace volume variable with named volume', () => {
      const compose = new DockerComposeYaml(composeWithVariables, null);
      compose.parseVariables(
        { hostVolume: 'named-volume', isNamed: true },
        { labDomain: 'example.com' },
        null
      );
      const service = compose.content.services['var-service'];
      expect(service.volumes).toContain('named-volume:/data');
      expect(service.volumes).toContain('named-volume-subdir:/data/subdir');
      expect(compose.content.volumes['named-volume']).toBeDefined();
      expect(compose.content.volumes['named-volume-subdir']).toBeDefined();
    });

    it('should replace environment variables', () => {
      const compose = new DockerComposeYaml(composeWithVariables, null);
      compose.replaceEnvVariables({
        LAB_DOMAIN: 'production.com',
        CONTAINER_PREFIX: 'test-prefix',
      });
      const service = compose.content.services['var-service'];
      expect(service.container_name).toBe('test-prefix-nginx');
      expect(service.environment).toContain('DOMAIN=production.com');
    });

    it('should add CONTAINER_PREFIX based on brick and unique name', () => {
      const compose = new DockerComposeYaml(composeWithVariables, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'example.com' },
        null
      );
      const service = compose.content.services['var-service'];
      // For 'all' env, the prefix doesn't include the env suffix
      // CONTAINER_PREFIX should be "var-brick-var-unique" (without -all suffix)
      expect(service.container_name).toContain('var-brick-var-unique-nginx');
    });

    it('should parse custom env variables', () => {
      // Create compose with a custom variable placeholder
      const composeWithCustomVar = `
x-gws-config:
  brickName: custom-brick
  uniqueName: custom-unique
  env: dev

services:
  custom-service:
    image: nginx:latest
    container_name: custom-container
    environment:
      - CUSTOM_ENV=\${CUSTOM_VAR}
`;
      const compose = new DockerComposeYaml(composeWithCustomVar, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'example.com' },
        { CUSTOM_VAR: 'custom_value' }
      );
      const contentStr = compose.toString();
      expect(contentStr).toContain('custom_value');
    });
  });

  describe('X-GWS-Config processing', () => {
    it('should convert x-gws-config https labels to traefik labels', () => {
      const compose = new DockerComposeYaml(composeWithXGwsConfig, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'example.com' },
        null
      );
      const service = compose.content.services['web-service'];
      expect(service.labels).toBeDefined();
      expect(service.labels.length).toBeGreaterThan(0);
      // Check that traefik labels were added
      const traefikLabels = service.labels.filter((l) => l.startsWith('traefik.'));
      expect(traefikLabels.length).toBeGreaterThan(0);
      // Check that x-gws-config was removed from service
      expect(service['x-gws-config']).toBeUndefined();
    });

    it('should add port mapping instead of traefik labels for localhost', () => {
      const compose = new DockerComposeYaml(composeWithXGwsConfigLocalhost, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'localhost' },
        null
      );
      const service = compose.content.services['local-service'];
      expect(service.ports).toBeDefined();
      expect(service.ports).toContain('9090:8080');
      // x-gws-config should be removed
      expect(service['x-gws-config']).toBeUndefined();
    });

    it('should use internalPort as localhostHostPort if not specified', () => {
      const composeContent = `
x-gws-config:
  brickName: local-brick
  uniqueName: local-unique
  env: dev

services:
  local-service:
    image: nginx:latest
    container_name: local-container
    x-gws-config:
      - https:
          name: localapp
          subDomain: local
          internalPort: 3000
`;
      const compose = new DockerComposeYaml(composeContent, null);
      compose.parseVariables(
        { hostVolume: '/test/volume', isNamed: false },
        { labDomain: 'localhost' },
        null
      );
      const service = compose.content.services['local-service'];
      expect(service.ports).toContain('3000:3000');
    });
  });

  describe('Metadata operations', () => {
    let compose: DockerComposeYaml;

    beforeEach(() => {
      compose = new DockerComposeYaml(sampleComposeContent, null);
    });

    it('should get and set description', () => {
      compose.setDescription('Test description');
      expect(compose.getDescription()).toBe('Test description');
    });

    it('should get and set autoStart', () => {
      compose.setAutoStart(true);
      expect(compose.getAutoStart()).toBe(true);
      compose.setAutoStart(false);
      expect(compose.getAutoStart()).toBe(false);
    });

    it('should get and set env', () => {
      compose.setEnv('prod');
      expect(compose.getEnv()).toBe('prod');
    });

    it('should get compose ID', () => {
      const composeId = compose.getComposeId();
      expect(composeId).toEqual({
        brickName: 'test-brick',
        uniqueName: 'test-unique',
        env: 'dev',
      });
    });
  });

  describe('Serialization and comparison', () => {
    let compose1: DockerComposeYaml;
    let compose2: DockerComposeYaml;

    beforeEach(() => {
      compose1 = new DockerComposeYaml(sampleComposeContent, null);
      compose2 = new DockerComposeYaml(sampleComposeContent, null);
    });

    it('should convert to string', () => {
      const str = compose1.toString();
      expect(str).toContain('test-brick');
      expect(str).toContain('test-service');
      expect(str).toContain('nginx:latest');
    });

    it('should compare equal composes', () => {
      expect(compose1.equalTo(compose2)).toBe(true);
    });

    it('should compare different composes', () => {
      compose2.addEnvironmentVariable('test-service', 'NEW_VAR', 'value');
      expect(compose1.equalTo(compose2)).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have correct network constants', () => {
      expect(DockerComposeYaml.NETWORK_DEV).toBe('gencovery-network-dev');
      expect(DockerComposeYaml.NETWORK_PROD).toBe('gencovery-network-prod');
    });

    it('should have correct variable name constants', () => {
      expect(DockerComposeYaml.LAB_NETWORK_VAR_NAME).toBe('${LAB_NETWORK}');
      expect(DockerComposeYaml.LAB_VOLUME_HOST_VAR_NAME).toBe('${LAB_VOLUME_HOST}');
      expect(DockerComposeYaml.CONTAINER_PREFIX).toBe('CONTAINER_PREFIX');
      expect(DockerComposeYaml.LAB_DOMAIN_VAR_NAME).toBe('LAB_DOMAIN');
    });

    it('should have correct x-gws-config constants', () => {
      expect(DockerComposeYaml.X_HTTPS_LABELS).toBe('https');
      expect(DockerComposeYaml.X_GWS_CONFIG).toBe('x-gws-config');
    });
  });

  describe('Integration test with real template', () => {
    it('should create DockerComposeYaml from main template like in createMainComposeObject', () => {
      // This test mimics how createMainComposeObject creates a DockerComposeYaml instance
      const mainComposeId: DockerComposeUniqueId = {
        brickName: 'gws_core',
        uniqueName: 'main',
        env: 'all',
      };

      // Use the sample content as a simplified version of the main compose file
      const compose = new DockerComposeYaml(sampleComposeContent, mainComposeId);

      expect(compose).toBeDefined();
      expect(compose.getBrickName()).toBe('gws_core');
      expect(compose.getUniqueName()).toBe('main');
      expect(compose.getEnv()).toBe('all');
      expect(compose.getServiceNames().length).toBeGreaterThan(0);
    });
  });
});
