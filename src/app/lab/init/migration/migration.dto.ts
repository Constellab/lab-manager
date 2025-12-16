/**
 * DTO representing a single migration's description
 */
export interface LabManagerMigrationDescriptionDTO {
  /**
   * The version this migration upgrades to (e.g., "2.0.0")
   */
  version: string;

  /**
   * Markdown-formatted description of what this migration does
   */
  description: string;
}

/**
 * DTO representing a complete migration plan
 */
export interface LabManagerMigrationPlanDTO {
  /**
   * The current source version
   */
  sourceVersion: string;

  /**
   * The target version to migrate to
   */
  targetVersion: string;

  /**
   * List of migrations that will be executed, in order
   */
  migrations: LabManagerMigrationDescriptionDTO[];
}
