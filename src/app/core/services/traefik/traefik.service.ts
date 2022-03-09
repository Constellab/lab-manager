import {Injectable} from '@nestjs/common';
import {CoreConfigService} from '../config/core-config.service';


@Injectable()
export class TraefikService {

  constructor(private configService: CoreConfigService) {
  }

  /**
   * Methods to get the list of labels to enable https for traefik
   * @param serviceName
   * @param servicePort
   */
  public getTraefikLabels(serviceName: string, servicePort: string): string[] {
    // host = serviceName.*.gencovery.io
    const host = serviceName + '.' + this.configService.getVirtualHost();
    const router = `${serviceName}-router`;
    const service = `${serviceName}-service`;
    return [
      `'traefik.enable=true'`,
      // Config for the HTTPS glab domain to port 8080
      `'traefik.http.routers.${router}.rule=host(\`${host}\`)'`,
      `'traefik.http.routers.${router}.service=${service}'`,
      `'traefik.http.services.${service}.loadbalancer.server.port=${servicePort}'`,
      // Enable HTTPS
      `'traefik.http.routers.${router}.entrypoints=websecure'`,
      `'traefik.http.routers.${router}.tls.certresolver=myresolver'`,
    ];
  }
}