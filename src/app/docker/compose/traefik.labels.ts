export class TraefikLabels {
  private labels: string[] = [];

  public addTraefikDomainLabels(hostRule: string, servicePort: number, serviceName: string): TraefikLabels {
    this.addTraefikRouterLabels(`Host(\`${hostRule}\`)`, servicePort, serviceName);
    return this;
  }

  /**
   * Get the list of labels to enable new https route with traefik
   * @param hostRule
   * @param servicePort
   * @param serviceName
   * @returns
   */
  public addTraefikRouterLabels(hostRule: string, servicePort: number, serviceName: string): TraefikLabels {
    const router = `${serviceName}-router`;
    const service = `${serviceName}-service`;
    this.labels.push(
      // Config for the HTTPS glab domain to port 8080
      `traefik.http.routers.${router}.rule=${hostRule}`,
      `traefik.http.routers.${router}.service=${service}`,
      `traefik.http.services.${service}.loadbalancer.server.port=${servicePort}`,
      // Enable HTTPS
      `traefik.http.routers.${router}.entrypoints=websecure`,
      `traefik.http.routers.${router}.tls=true`
    );

    return this;
  }

  public hasLabels(): boolean {
    return this.labels.length > 0;
  }

  public getLabels(network?: string): string[] {
    const labels = ['traefik.enable=true', ...this.labels];
    if (network) {
      labels.push(`traefik.docker.network=${network}`);
    }
    return labels;
  }
}
