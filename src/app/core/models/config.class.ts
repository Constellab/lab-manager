/**
 * Deployment mode of the lab manager. Controls Docker compose selection,
 * API key enforcement, logging destination, and whether the standalone
 * configuration front is auto-started.
 *
 * - `dev`           Local development on the maintainer's machine. Uses
 *                   `docker-compose-local.yml`, skips API key, console-only logs.
 * - `pre-prod`      Staging variant of `prod` (currently behaves like prod).
 * - `prod`          Standard cloud deployment. Full `docker-compose.yml` stack
 *                   behind traefik, API key required, file logging enabled.
 *                   The lab manager is reachable from the Constellab cloud.
 * - `desktop`       Standalone single-user install. Runs the lab manager plus
 *                   a local standalone front container (exposed on host port 82)
 *                   so the user can configure the lab without going through the
 *                   cloud. API key is bypassed.
 * - `private-cloud` Prod-grade cloud lab installed on a private network where
 *                   the Constellab cloud cannot reach the lab manager API.
 *                   Behaves like `prod` for the compose lifecycle, but also
 *                   starts the standalone front (exposed via traefik on
 *                   `lab-config.${VIRTUAL_HOST}`) and bypasses the API key so
 *                   an on-site operator can configure the lab directly.
 * - `test`          Automated test runs. Treated as local.
 */
export type EnvironmentProfile = 'dev' | 'pre-prod' | 'prod' | 'desktop' | 'private-cloud' | 'test';
export type LabEnvironment = 'dev' | 'prod';

export const apiKeyHeader = 'Authorization';
export const authorizationSchema = 'api-key';
