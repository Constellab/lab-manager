import { Injectable, Logger } from '@nestjs/common';
import { ClVersion } from '../../../core/models/version.class';
import { ConfigFileService } from '../../../core/services/config-file/config-file.service';
import { CoreConfigService } from '../../../core/services/config/core-config.service';
import { FileService } from '../../../core/services/file/file.service';
import { TaskService } from '../../../core/services/task/task.service';
import { DockerComposeService } from '../../../docker/compose/docker-compose.service';
import { MainComposeService } from '../../../docker/compose/main-compose.service';
import { Migration } from './migration.interface';
import { Migration280 } from './migrations/migration_2.8.0';
import { Migration2110 } from './migrations/migration_2.11.0';

/**
 * Type for migration class constructors
 */
export type MigrationClass = new (...args: any[]) => Migration;

/**
 * Service that manages and executes migrations during lab initialization.
 * Migrations are executed when the lab manager version is upgraded.
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private fileService: FileService,
    private configService: CoreConfigService,
    private taskService: TaskService,
    private configFileService: ConfigFileService,
    private dockerComposeService: DockerComposeService,
    private mainComposeService: MainComposeService
  ) {}

  /**
   * Execute all pending migrations based on the last init version.
   * Migrations are executed in order, and if any migration fails, the process stops.
   * @throws Error if any migration fails
   */
  public async executeMigrations(): Promise<void> {
    const taskName = 'Running migrations';

    try {
      // Get the current lab manager version
      const currentVersionString = this.configService.getLabManagerVersion();
      const currentVersion = ClVersion.fromString(currentVersionString);

      // Get the last init version from private file
      let lastInitVersion: ClVersion = null;
      if (this.fileService.privateFileExists()) {
        const privateFile = this.fileService.readPrivateFile();
        const lastInitVersionString = privateFile.data?.last_init_manager_version;

        if (lastInitVersionString) {
          try {
            lastInitVersion = ClVersion.fromString(lastInitVersionString);
          } catch (e) {
            this.logger.warn(
              `Invalid last_init_manager_version '${lastInitVersionString}', treating as first init`
            );
          }
        }
      }

      // If no last init version, this is the first init, skip migrations
      if (!lastInitVersion) {
        this.logger.log('No previous init version found, skipping migrations (first init)');
        return;
      }

      if (currentVersion.isEqual(lastInitVersion)) {
        return;
      }

      // Sort migrations by destination version (ascending)
      const migrations = this.getRegisteredMigrations();

      // Filter migrations that need to be executed using their applies() method
      const pendingMigrations = migrations.filter((migration) =>
        migration.applies(lastInitVersion, currentVersion)
      );

      if (pendingMigrations.length === 0) {
        this.logger.log(
          `No pending migrations (current: ${currentVersionString}, last init: ${lastInitVersion.toString()})`
        );
        return;
      }

      this.logger.log(
        `Found ${pendingMigrations.length} pending migration(s) from version ` +
          `${lastInitVersion.toString()} to ${currentVersionString}`
      );
      this.taskService.newTask(taskName, `Executing ${pendingMigrations.length} migration(s)`);

      // Execute migrations in order
      for (const migration of pendingMigrations) {
        const destinationVersion = migration.getDestinationVersion();
        const description = migration.getDescription();

        this.taskService.updateTask(taskName, 'RUNNING', description);
        this.logger.log(`Executing migration: ${description} (destination version: ${destinationVersion})`);

        try {
          await migration.migrate(currentVersionString);
          this.taskService.updateTask(taskName, 'RUNNING', `Completed: ${description}`);
        } catch (error) {
          if (error.stack) {
            this.logger.error(error.stack);
          }
          throw new Error(`Migration to version ${destinationVersion} failed: ${error.message}`);
        }
      }

      this.taskService.markTaskAsSuccess(
        taskName,
        `Successfully executed ${pendingMigrations.length} migration(s)`
      );
    } catch (error) {
      this.taskService.markTaskAsError(taskName, `Migration process failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all registered migrations sorted by destination version.
   */
  private getRegisteredMigrations(): Migration[] {
    const migrations = [
      new Migration280(this.configFileService),
      new Migration2110(
        this.dockerComposeService,
        this.fileService,
        this.configService,
        this.mainComposeService
      ),
    ];
    return migrations.sort((a, b) => a.getDestinationVersionObject().getDif(b.getDestinationVersionObject()));
  }
}
