/**
 * Object to support version like 2.1.1
 */
export class ClVersion {
  constructor(
    public major: number,
    public minor: number,
    public patch: number
  ) {}

  public static fromString(version: string): ClVersion {
    if (version == null || version.length < 5) {
      throw new Error(`Version '${version}' is invalid`);
    }

    const versions = version.split('.');
    if (versions.length !== 3) {
      throw new Error(`Version '${version}' is invalid`);
    }

    // extract other versions
    const mainVersions = version.split('.');

    const major = parseInt(mainVersions[0]);
    const minor = parseInt(mainVersions[1]);
    const patch = parseInt(mainVersions[2]);

    if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
      throw new Error(`Version '${version}' is invalid`);
    }

    return new ClVersion(major, minor, patch);
  }

  public isEqualOrHigher(other: ClVersion): boolean {
    return this.getDif(other) >= 0;
  }

  public isHigher(other: ClVersion): boolean {
    return this.getDif(other) > 0;
  }

  public isEqual(other: ClVersion): boolean {
    return this.getDif(other) === 0;
  }

  /**
   * Returns the difference between this version and another version
   * === 0 if equal
   * 1 if this version is higher
   * -1 if other version is higher
   * @param other
   */
  public getDif(other: ClVersion): number {
    if (this.major === other.major && this.minor === other.minor && this.patch === other.patch) {
      return 0;
    }

    if (
      this.major > other.major ||
      (this.major === other.major && this.minor > other.minor) ||
      (this.major === other.major && this.minor === other.minor && this.patch > other.patch) ||
      (this.major === other.major && this.minor === other.minor && this.patch === other.patch)
    ) {
      return 1;
    } else {
      return -1;
    }
  }

  public toString(): string {
    return [this.major, this.minor, this.patch].join('.');
  }
}
