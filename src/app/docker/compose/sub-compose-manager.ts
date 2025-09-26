import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DockerComposeYaml } from './docker-compose-yaml';

export interface SubComposeInfo {
  brickName: string;
  uniqueName: string;
  composeFilePath: string;
  composeFileContent: string;
}

export interface SubComposeList {
  composes: SubComposeInfo[];
}

export class SubComposeManager {
  private subComposeFolderPath: string;

  constructor(subComposeFolderPath: string) {
    this.subComposeFolderPath = subComposeFolderPath;
    this.ensureSubComposeFolderExists();
  }

  public getSubCompose(brickName: string, uniqueName: string): SubComposeInfo | null {
    const composeFilePath = this.getComposeFilePath(brickName, uniqueName);

    if (!existsSync(composeFilePath)) {
      return null;
    }

    return {
      brickName,
      uniqueName,
      composeFilePath,
      composeFileContent: readFileSync(composeFilePath, { encoding: 'utf-8' }),
    };
  }

  public getAllSubComposes(): SubComposeList {
    const subFolders = this.getAllSubFolders();
    const composes: SubComposeInfo[] = [];

    for (const folderName of subFolders) {
      const folderPath = join(this.subComposeFolderPath, folderName);
      const composeFilePath = join(folderPath, 'docker-compose.yml');

      if (existsSync(composeFilePath)) {
        try {
          const composeYaml = DockerComposeYaml.fromFile(composeFilePath);
          composes.push({
            brickName: composeYaml.getBrickName(),
            uniqueName: composeYaml.getUniqueName(),
            composeFilePath,
            composeFileContent: readFileSync(composeFilePath, { encoding: 'utf-8' }),
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
    const brickName = composeYaml.getBrickName();
    const uniqueName = composeYaml.getUniqueName();

    const subFolderPath = this.getSubFolderPath(brickName, uniqueName);
    const composeFilePath = this.getComposeFilePath(brickName, uniqueName);

    // Ensure the specific subfolder exists
    this.ensureDirectoryExists(subFolderPath);

    // Write the compose file as docker-compose.yml
    writeFileSync(composeFilePath, composeYaml.toString());

    return composeFilePath;
  }

  public deleteSubCompose(brickName: string, uniqueName: string): boolean {
    const subFolderPath = this.getSubFolderPath(brickName, uniqueName);

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
    }
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  private getSubFolderPath(brickName: string, uniqueName: string): string {
    const subFolderName = `${brickName}-${uniqueName}`;
    return join(this.subComposeFolderPath, subFolderName);
  }

  private getComposeFilePath(brickName: string, uniqueName: string): string {
    const subFolderPath = this.getSubFolderPath(brickName, uniqueName);
    return join(subFolderPath, 'docker-compose.yml');
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
