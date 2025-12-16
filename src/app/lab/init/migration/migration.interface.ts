import { ClVersion } from '../../../core/models/version.class';

/**
 * Abstract base class for lab migrations.
 * Each migration should extend this class and implement the required methods.
 */
export abstract class Migration {
  /**
   * Returns the destination version this migration upgrades to
   */
  abstract getDestinationVersion(): string;

  /**
   * Checks if this migration applies based on source and destination versions
   * @param sourceVersion - The current version of the lab (last_init_manager_version)
   * @param targetVersion - The version the lab is being upgraded to (current lab manager version)
   * @returns true if this migration should be executed
   */
  abstract applies(sourceVersion: ClVersion, targetVersion: ClVersion): boolean;

  /**
   * Executes the migration
   * @param targetVersion - The final target version (current lab manager version)
   */
  abstract migrate(targetVersion: string): Promise<void>;

  /**
   * Returns a markdown formatted description explaining what this migration does
   * This is useful for documentation and user communication
   */
  abstract getDescription(): string;

  /**
   * Returns the destination version as a ClVersion object
   */
  getDestinationVersionObject(): ClVersion {
    return ClVersion.fromString(this.getDestinationVersion());
  }

  /**
   * Helper method to compare versions
   * @returns 0 if equal, 1 if v1 > v2, -1 if v1 < v2
   */
  protected compareVersions(v1: ClVersion, v2: ClVersion): number {
    return v1.getDif(v2);
  }
}
