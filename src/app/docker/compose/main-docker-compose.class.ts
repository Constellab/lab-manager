import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { DockerCompose } from './docker-compose.class';

export enum MainComposeServiceName {
  GLAB = 'glab',
  CODELAB = 'codelab',
  FRONT = 'front',
  GWS_CORE_PROD_DB = 'gws_core_prod_db',
  GWS_CORE_DEV_DB = 'gws_core_dev_db',
  TEST_GWS_DEV_DB = 'test_gws_dev_db',
  GWS_BIOTA_DB = 'gws_biota_db',
}

/**
 * Main Docker Compose manager for lab services.
 *
 * This class manages the main docker-compose.yml file that contains core lab services
 * including the MariaDB production database.
 *
 * ## Docker-in-Docker Architecture
 *
 * This code runs inside the lab-manager container as a non-root user (labuser) and
 * uses Docker-in-Docker to manage other containers including the MariaDB container.
 * The lab-manager has access to the Docker socket to run docker commands.
 *
 * ## Database Backup/Restore Strategy
 *
 * - **Dump**: Executes mysqldump inside the MariaDB container and captures output to
 *   a file in the lab-manager container's temporary directory (/tmp/db-dumps)
 * - **Restore**: Pipes the dump file from the lab-manager container into mysql running
 *   inside the MariaDB container using stdin redirection
 *
 * This approach avoids permission issues that would occur if we tried to write directly
 * to the MariaDB container's /var/lib/mysql directory (owned by root).
 */
export class MainDockerCompose extends DockerCompose {
  public static readonly GLAB_INTERNAL_PORT = 3000;

  public static readonly MARIA_DB_USERNAME = 'mysql';

  /////////////////////////////// BIOTA ///////////////////////////////

  public deleteBiotaService(): Promise<boolean> {
    return this.downService(MainComposeServiceName.GWS_BIOTA_DB);
  }

  public async startBiotaService(): Promise<string> {
    return await this.composeUp([], [MainComposeServiceName.GWS_BIOTA_DB]);
  }

  //////////////////////// PROD DB MANAGEMENT ////////////////////////
  /**
   * Dump the production database to a file in the lab-manager container.
   *
   * ## How it works:
   * 1. Executes `mysqldump` inside the MariaDB container via `docker exec`
   * 2. Streams the SQL dump output directly to a file (avoids memory buffer limits)
   * 3. The dump file is stored in the lab-manager container's filesystem
   *
   * ## Why use docker exec with output redirection:
   * - Runs mysqldump as the 'mysql' user inside the MariaDB container
   * - Avoids permission issues (no need to write to MariaDB's /var/lib/mysql)
   * - Streams directly to file to avoid Node.js maxBuffer limits for large databases
   * - The dump file is stored in lab-manager's filesystem (e.g., /tmp/db-dumps)
   *   where the labuser has write permissions
   *
   * ## Command executed:
   * ```
   * docker exec -u mysql gws_core_prod_db sh -c "mysqldump --user='root' \
   *   --password=$MYSQL_ROOT_PASSWORD --max_allowed_packet=256M $MYSQL_DATABASE" \
   *   > /tmp/db-dumps/dump.sql
   * ```
   *
   * @param dumpFilePath - Path where to save the dump file in the lab-manager container
   *                       (e.g., /tmp/db-dumps/dump.sql)
   * @returns Error message if any, empty string on success
   */
  public async dumpProdDb(dumpFilePath: string): Promise<string> {
    try {
      // Ensure directory exists
      const dir = dirname(dumpFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Stream mysqldump output directly to file using shell redirection
      // This avoids Node.js maxBuffer limits for large databases
      await this.execCommandInService(
        MainComposeServiceName.GWS_CORE_PROD_DB,
        `sh -c "mysqldump --user='root' --password=\\$MYSQL_ROOT_PASSWORD ` +
          `--max_allowed_packet=256M \\$MYSQL_DATABASE"`,
        { user: MainDockerCompose.MARIA_DB_USERNAME },
        `> ${dumpFilePath}` // Redirect output to file
      );

      return '';
    } catch (error) {
      return error.message || error.toString();
    }
  }

  /**
   * Restore the production database from a dump file in the lab-manager container.
   *
   * ## How it works:
   * 1. Ensures the MariaDB container is running (starts it if needed)
   * 2. Reads the dump file from the lab-manager container's filesystem
   * 3. Pipes the file content via stdin to mysql running inside the MariaDB container
   * 4. Stops the container if we started it (maintains previous state)
   *
   * ## Using execCommandInService with shellSuffix:
   * - Uses the `-i` flag for interactive mode (accepts stdin)
   * - The stdin redirection (`< dumpFilePath`) is passed as `shellSuffix`
   * - The redirection happens at the **outer shell level** (lab-manager container's shell)
   * - This pipes the file content as stdin to the mysql process inside the MariaDB container
   *
   * ## Command executed:
   * ```
   * docker exec -i -u mysql gws_core_prod_db sh -c "mysql --user='root' \
   *   --password=$MYSQL_ROOT_PASSWORD --max_allowed_packet=256M $MYSQL_DATABASE" \
   *   < /tmp/db-dumps/dump.sql
   * ```
   *
   * ## Architecture:
   * ```
   * ┌─────────────────────────────────────────┐
   * │  Lab-Manager Container (as labuser)     │
   * │                                         │
   * │  /tmp/db-dumps/dump.sql  ← File here    │
   * │                                         │
   * │  Shell redirection reads from here ─────┼─┐
   * └─────────────────────────────────────────┘ │
   *                                             │
   *   stdin piped to ───────────────────────────┘
   *                                             │
   * ┌────────────────────────────────────────┐  │
   * │  MariaDB Container (gws_core_prod_db)  │  │
   * │                                        │  │
   * │  mysql process receives data via stdin ◄──┘
   * │                                         │
   * └─────────────────────────────────────────┘
   * ```
   *
   * @param dumpFilePath - Path to the dump file in the lab-manager container
   *                       (e.g., /tmp/db-dumps/dump.sql)
   * @returns Error message if any, empty string on success
   */
  public async restoreProdDb(dumpFilePath: string): Promise<string> {
    try {
      // Use execCommandInService with -i flag and stdin redirection via shellSuffix
      await this.execCommandInService(
        MainComposeServiceName.GWS_CORE_PROD_DB,
        `sh -c "mysql --user='root' --password=\\$MYSQL_ROOT_PASSWORD ` +
          `--max_allowed_packet=256M \\$MYSQL_DATABASE"`,
        {
          user: MainDockerCompose.MARIA_DB_USERNAME,
          interactive: true,
        },
        `< ${dumpFilePath}` // Shell redirection happens at outer shell level
      );
      return '';
    } catch (error) {
      return error.message || error.toString();
    }
  }

  public async prodDbIsRunning(): Promise<boolean> {
    return this.serviceIsRunning(MainComposeServiceName.GWS_CORE_PROD_DB);
  }
}
