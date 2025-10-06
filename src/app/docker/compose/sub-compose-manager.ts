import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DockerComposeYaml } from './docker-compose-yaml';
import { DockerCompose } from './docker-compose.class';
import { ComposeInfo, ComposeList, DockerComposeUniqueId } from './docker-compose.types';

export class SubComposeManager {
  private subComposeFolderPath: string;

  constructor(subComposeFolderPath: string) {
    this.subComposeFolderPath = subComposeFolderPath;
    this.ensureSubComposeFolderExists();
  }

  public getAllSubComposes(): ComposeList {
    const subFolders = this.getAllSubFolders();
    const composes: ComposeInfo[] = [];

    for (const folderName of subFolders) {
      const folderPath = join(this.subComposeFolderPath, folderName);
      const composeFilePath = join(folderPath, 'docker-compose.yml');

      if (existsSync(composeFilePath)) {
        try {
          const composeYaml = DockerComposeYaml.fromFile(composeFilePath);
          composes.push({
            brickName: composeYaml.getBrickName(),
            uniqueName: composeYaml.getUniqueName(),
            env: composeYaml.getEnv(),
            composeFilePath,
            isSubCompose: true,
            description: composeYaml.getDescription(),
          });
        } catch (error) {
          // Skip invalid docker-compose files
          console.warn(`Failed to parse docker-compose.yml in ${folderPath}:`, error.message);
        }
      }
    }

    return { composes };
  }

  public addSubCompose(composeYaml: DockerComposeYaml): string {
    const subFolderPath = this.getSubFolderPath(composeYaml.getComposeId());
    const composeFilePath = this.getComposeFilePath(composeYaml.getComposeId());

    // Ensure the specific subfolder exists
    this.ensureDirectoryExists(subFolderPath);

    // Write the compose file as docker-compose.yml
    writeFileSync(composeFilePath, composeYaml.toString());

    return composeFilePath;
  }

  /**
   * Add a sub-compose from a source directory containing additional files
   * The docker-compose.yml will be generated from the composeYaml object
   * @param composeYaml The DockerComposeYaml instance to generate docker-compose.yml from
   * @param sourceDir The source directory containing all files including docker-compose.yml
   * @returns The path to the created docker-compose.yml file
   */
  public addSubComposeFromDirectory(composeYaml: DockerComposeYaml, sourceDir: string): string {
    if (!existsSync(sourceDir)) {
      throw new Error(`Source directory does not exist: ${sourceDir}`);
    }

    const subFolderPath = this.getSubFolderPath(composeYaml.getComposeId());

    // Remove existing folder if it exists to ensure clean state
    if (existsSync(subFolderPath)) {
      rmSync(subFolderPath, { recursive: true, force: true });
    }

    // Create the subfolder
    this.ensureDirectoryExists(subFolderPath);

    // Copy all files from source directory to subfolder
    this.copyDirectoryContents(sourceDir, subFolderPath);

    // Override docker-compose.yml with the generated content from composeYaml
    const composeFilePath = this.getComposeFilePath(composeYaml.getComposeId());
    writeFileSync(composeFilePath, composeYaml.toString());

    return composeFilePath;
  }

  /**
   * Recursively copy all contents from source directory to destination directory
   * @param sourceDir Source directory path
   * @param destDir Destination directory path
   */
  private copyDirectoryContents(sourceDir: string, destDir: string): void {
    const entries = readdirSync(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name);
      const destPath = join(destDir, entry.name);

      if (entry.isDirectory()) {
        this.ensureDirectoryExists(destPath);
        this.copyDirectoryContents(sourcePath, destPath);
      } else {
        copyFileSync(sourcePath, destPath);
        if (this.isExecutableFile(entry.name)) {
          chmodSync(destPath, 0o755);
        }
      }
    }
  }

  /**
   * Check if a file should be executable based on its extension
   * @param filename The filename to check
   * @returns true if the file should be executable
   */
  private isExecutableFile(filename: string): boolean {
    const executableExtensions = ['.sh', '.py', '.pl', '.rb', '.bash', '.zsh', '.fish', '.js'];
    return executableExtensions.some((ext) => filename.endsWith(ext));
  }

  public deleteSubCompose(composeId: DockerComposeUniqueId): boolean {
    const subFolderPath = this.getSubFolderPath(composeId);

    if (!existsSync(subFolderPath)) {
      return false;
    }

    // Delete the entire folder and its contents
    rmSync(subFolderPath, { recursive: true, force: true });
    return true;
  }

  private ensureSubComposeFolderExists(): void {
    if (!existsSync(this.subComposeFolderPath)) {
      mkdirSync(this.subComposeFolderPath, { recursive: true });
      chmodSync(this.subComposeFolderPath, 0o755);
    }
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      chmodSync(dirPath, 0o755);
    }
  }

  private getSubFolderPath(composeId: DockerComposeUniqueId): string {
    let subFolderName = `${composeId.brickName}-${composeId.uniqueName}`;
    if (composeId.env === 'dev' || composeId.env === 'prod') {
      subFolderName = `${subFolderName}-${composeId.env}`;
    }
    return join(this.subComposeFolderPath, subFolderName);
  }

  public getComposeFilePath(composeId: DockerComposeUniqueId): string {
    const subFolderPath = this.getSubFolderPath(composeId);
    return join(subFolderPath, 'docker-compose.yml');
  }

  public getSubCompose(composeId: DockerComposeUniqueId): DockerCompose | null {
    const composeFilePath = this.getComposeFilePath(composeId);

    if (!existsSync(composeFilePath)) {
      return null;
    }

    const composeYaml = DockerComposeYaml.fromFile(composeFilePath);
    return new DockerCompose(composeFilePath, composeYaml);
  }

  private getAllSubFolders(): string[] {
    if (!existsSync(this.subComposeFolderPath)) {
      return [];
    }
    return readdirSync(this.subComposeFolderPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  }
}
