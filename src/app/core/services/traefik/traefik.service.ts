import { Injectable } from '@nestjs/common';

@Injectable()
export class TraefikService {
  /**
   * Methods to get the list of labels to enable https for traefik
   * @param serviceName
   * @param servicePort
   */
  public getTraefikLabels(host: string, servicePort: string, serviceName: string): string[] {
    return [
      `traefik.enable=true`,
      ...this.getTraefikRouterLabels(`host(\`${host}\`)`, servicePort, serviceName),
    ];
  }

  /**
   * Get the list of labels to enable new https route with traefik
   * @param hostRule
   * @param servicePort
   * @param serviceName
   * @returns
   */
  public getTraefikRouterLabels(hostRule: string, servicePort: string, serviceName: string): string[] {
    const router = `${serviceName}-router`;
    const service = `${serviceName}-service`;
    return [
      // Config for the HTTPS glab domain to port 8080
      `traefik.http.routers.${router}.rule=${hostRule}`,
      `traefik.http.routers.${router}.service=${service}`,
      `traefik.http.services.${service}.loadbalancer.server.port=${servicePort}`,
      // Enable HTTPS
      `traefik.http.routers.${router}.entrypoints=websecure`,
      `traefik.http.routers.${router}.tls=true`,
    ];
  }
}
