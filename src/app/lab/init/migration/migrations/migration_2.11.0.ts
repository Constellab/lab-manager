import { Logger } from '@nestjs/common';
import { existsSync } from 'fs';
import { ClVersion } from '../../../../core/models/version.class';
import { CoreConfigService } from '../../../../core/services/config/core-config.service';
import { FileService } from '../../../../core/services/file/file.service';
import { DockerComposeService } from '../../../../docker/compose/docker-compose.service';
import { MainComposeServiceName } from '../../../../docker/compose/main-docker-compose.class';
import { MainComposeService } from '../../../../docker/compose/main-compose.service';
import { Migration } from '../migration.interface';

/**
 * Migration for version 2.11.0 that upgrades MariaDB from 10.7.4 to 11.8.6.
 *
 * MariaDB major version upgrades change the on-disk InnoDB format, so we cannot
 * simply swap the image and keep the existing data volume. Instead, for each
 * database environment (prod, dev) that has a persistent volume:
 *
 * 1. Start the old container (10.7.4 from existing conf compose)
 * 2. Dump the database via mysqldump
 * 3. Stop the container and delete the MariaDB data volume directory
 * 4. Regenerate the compose file from the template (which ships with 11.8.6)
 * 5. Start the new container (11.8.6, fresh init)
 * 6. Restore the dump into the new container
 *
 * test_gws_dev_db has no persistent volume, so it only needs the image bump.
 *
 * Local environments use named Docker volumes (not directory mounts), so
 * this migration is automatically skipped for local/desktop environments.
 */
export class Migration2110 extends Migration {
  private readonly logger = new Logger(Migration2110.name);

  private static readonly TEMP_DUMP_DIR = '/tmp/db-migration-dumps';

  constructor(
    private dockerComposeService?: DockerComposeService,
    private fileService?: FileService,
    private configService?: CoreConfigService,
    private mainComposeService?: MainComposeService
  ) {
    super();
  }

  getDestinationVersion(): string {
    return '2.11.0';
  }

  applies(sourceVersion: ClVersion, targetVersion: ClVersion): boolean {
    const destinationVersion = this.getDestinationVersionObject();
    const isAfterSource = destinationVersion.isHigher(sourceVersion);
    const isBeforeOrEqualTarget = targetVersion.isEqualOrHigher(destinationVersion);
    return isAfterSource && isBeforeOrEqualTarget;
  }

  async migrate(): Promise<void> {
    if (!this.dockerComposeService || !this.fileService || !this.configService || !this.mainComposeService) {
      throw new Error(
        'DockerComposeService, FileService, CoreConfigService, and MainComposeService ' +
          'are required for this migration'
      );
    }

    this.logger.log('Starting MariaDB upgrade migration from 10.7.4 to 11.8.6');

    const prodVolumePath = this.configService.getGwsCoreDbMariaDbFolder('prod');
    const devVolumePath = this.configService.getGwsCoreDbMariaDbFolder('dev');
    const prodDumpPath = `${Migration2110.TEMP_DUMP_DIR}/prod_dump.sql`;
    const devDumpPath = `${Migration2110.TEMP_DUMP_DIR}/dev_dump.sql`;

    const prodNeedsMigration = existsSync(prodVolumePath);
    const devNeedsMigration = existsSync(devVolumePath);

    if (!prodNeedsMigration && !devNeedsMigration) {
      this.logger.log('No existing database volumes found, skipping MariaDB upgrade migration');
      return;
    }

    // ========================================
    // PHASE 1: Dump databases using old compose (10.7.4)
    // ========================================
    // The conf compose file still has 10.7.4 at this point (before generateDockerCompose)
    const oldMainCompose = this.dockerComposeService.createMainComposeObject();

    if (prodNeedsMigration) {
      this.logger.log('[prod] Dumping database...');
      const dumpResult = await oldMainCompose.dumpProdDb(prodDumpPath);
      if (dumpResult !== '') {
        throw new Error(`[prod] Database dump failed: ${dumpResult}. Volume NOT deleted.`);
      }
      if (!existsSync(prodDumpPath)) {
        throw new Error(`[prod] Dump file not found at ${prodDumpPath}. Volume NOT deleted.`);
      }
      this.logger.log('[prod] Database dump completed');
    }

    if (devNeedsMigration) {
      this.logger.log('[dev] Dumping database...');
      const dumpResult = await oldMainCompose.dumpDevDb(devDumpPath);
      if (dumpResult !== '') {
        throw new Error(`[dev] Database dump failed: ${dumpResult}. Volume NOT deleted.`);
      }
      if (!existsSync(devDumpPath)) {
        throw new Error(`[dev] Dump file not found at ${devDumpPath}. Volume NOT deleted.`);
      }
      this.logger.log('[dev] Database dump completed');
    }

    // ========================================
    // PHASE 2: Stop containers and delete data volumes
    // ========================================
    if (prodNeedsMigration) {
      this.logger.log('[prod] Stopping database container and deleting data volume...');
      await oldMainCompose.downService(MainComposeServiceName.GWS_CORE_PROD_DB);
      this.fileService.deleteFolderIfExist(prodVolumePath);
      this.logger.log('[prod] Data volume deleted');
    }

    if (devNeedsMigration) {
      this.logger.log('[dev] Stopping database container and deleting data volume...');
      await oldMainCompose.downService(MainComposeServiceName.GWS_CORE_DEV_DB);
      this.fileService.deleteFolderIfExist(devVolumePath);
      this.logger.log('[dev] Data volume deleted');
    }

    // ========================================
    // PHASE 3: Regenerate compose with new image (11.8.6) and restore
    // ========================================
    // Regenerate the docker-compose file from the template (assets).
    // The template ships with the new lab-manager version and has mariadb:11.8.6.
    await this.mainComposeService.generateDockerCompose();
    const newMainCompose = this.dockerComposeService.createMainComposeObject();

    if (prodNeedsMigration) {
      this.logger.log('[prod] Restoring database into MariaDB 11.8.6...');
      const restoreResult = await newMainCompose.restoreProdDb(prodDumpPath);
      if (restoreResult !== '') {
        throw new Error(
          `[prod] Database restore failed: ${restoreResult}. ` +
            `Dump preserved at ${prodDumpPath} for manual recovery.`
        );
      }
      // Stop the container — the normal init flow will start it later
      await newMainCompose.downService(MainComposeServiceName.GWS_CORE_PROD_DB);
      this.logger.log('[prod] Database migration completed');
    }

    if (devNeedsMigration) {
      this.logger.log('[dev] Restoring database into MariaDB 11.8.6...');
      const restoreResult = await newMainCompose.restoreDevDb(devDumpPath);
      if (restoreResult !== '') {
        throw new Error(
          `[dev] Database restore failed: ${restoreResult}. ` +
            `Dump preserved at ${devDumpPath} for manual recovery.`
        );
      }
      await newMainCompose.downService(MainComposeServiceName.GWS_CORE_DEV_DB);
      this.logger.log('[dev] Database migration completed');
    }

    // Clean up temporary dump files
    this.fileService.deleteFolderIfExist(Migration2110.TEMP_DUMP_DIR);

    this.logger.log('MariaDB upgrade migration from 10.7.4 to 11.8.6 completed successfully');
  }

  getDescription(): string {
    return 'Upgrade MariaDB from 10.7.4 to 11.8.6 (dump, delete volume, restore for prod and dev databases)';
  }
}
