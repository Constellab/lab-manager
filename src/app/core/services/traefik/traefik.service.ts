import {Injectable} from '@nestjs/common';


@Injectable()
export class TraefikService {

  /**
   * Methods to get the list of labels to enable https for traefik
   * @param host
   * @param serviceName
   * @param servicePort
   */
  public getTraefikLabels(host: string, serviceName: string, servicePort: string): string[] {
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