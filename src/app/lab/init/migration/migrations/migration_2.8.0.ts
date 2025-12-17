import { ClVersion } from '../../../../core/models/version.class';
import { ConfigFileService } from '../../../../core/services/config-file/config-file.service';
import { BrickGWS } from '../../../../core/services/external/external-community.class';
import { Migration } from '../migration.interface';

/**
 * Migration for version 2.8.0 that updates brick versions to minimum required versions:
 * - gws_core to minimum 0.18.0
 * - gws_biota to minimum 0.10.0
 */
export class Migration280 extends Migration {
  /**
   * Constructor with optional service injection.
   * Services should be optional to allow instantiation by the migration system.
   */
  constructor(private configFileService?: ConfigFileService) {
    super();
  }

  getDestinationVersion(): string {
    return '2.8.0';
  }

  applies(sourceVersion: ClVersion, targetVersion: ClVersion): boolean {
    const destinationVersion = this.getDestinationVersionObject();

    // Apply if: sourceVersion < destinationVersion <= targetVersion
    const isAfterSource = destinationVersion.isHigher(sourceVersion);
    const isBeforeOrEqualTarget = targetVersion.isEqualOrHigher(destinationVersion);

    return isAfterSource && isBeforeOrEqualTarget;
  }

  async migrate(): Promise<void> {
    if (!this.configFileService) {
      throw new Error('ConfigFileService is required for this migration');
    }

    // Define minimum brick versions
    const bricksWithMinVersion = [
      {
        name: BrickGWS.GWS_CORE,
        version: '0.19.0',
      },
      {
        name: BrickGWS.GWS_BIOTA,
        version: '0.11.0',
      },
    ];

    // Update bricks to minimum versions
    this.configFileService.updateBricksToMinimumVersion(bricksWithMinVersion);
  }

  getDescription(): string {
    return 'Update brick versions to minimum required versions (gws_core: 0.18.0, gws_biota: 0.10.0)';
  }
}
