import { join } from 'path';
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

export class MainDockerCompose extends DockerCompose {
  public static readonly GLAB_INTERNAL_PORT = 3000;

  public static readonly MARIA_DB_FOLDER = '/var/lib/mysql';
  public static readonly MARIA_DB_DUMP_FOLDER_NAME = '.dumps';
  public static readonly MARIA_DB_DUMP_NAME = 'dump.sql';
  public static readonly MARIA_DB_USERNAME = 'mysql';

  /////////////////////////////// BIOTA ///////////////////////////////

  public deleteBiotaService(): Promise<boolean> {
    return this.downService(MainComposeServiceName.GWS_BIOTA_DB);
  }

  public async startBiotaService(): Promise<string> {
    return await this.composeUp([], [MainComposeServiceName.GWS_BIOTA_DB]);
  }

  //////////////////////// PROD DB MANAGEMENT ////////////////////////
  public async dumpProdDb(): Promise<string> {
    // create dump folder if not exists
    // use the db container to create the folder with the right permissions
    await this.execProdDbCommand(`sh -c "mkdir -p ${this.getDumpFolderPath()}"`);

    // delete previous dump if exists
    await this.execProdDbCommand(`sh -c "rm -f ${this.getDumpFilePath()}"`);

    return await this.execProdDbCommand(
      `sh -c "mysqldump --user='root' --password=\\$MYSQL_ROOT_PASSWORD` +
        ` --max_allowed_packet=256M \\$MYSQL_DATABASE > ${this.getDumpFilePath()}"`
    );
  }

  public async restoreProdDb(): Promise<string> {
    return await this.execProdDbCommand(
      `sh -c "mysql --user='root' --password=\\$MYSQL_ROOT_PASSWORD` +
        ` --max_allowed_packet=256M \\$MYSQL_DATABASE < ${this.getDumpFilePath()}"`
    );
  }

  public async deleteDumpFolder(): Promise<string> {
    return await this.execProdDbCommand(`sh -c "rm -rf ${this.getDumpFolderPath()}"`);
  }

  private execProdDbCommand(command: string): Promise<string> {
    return this.execCommandInService(MainComposeServiceName.GWS_CORE_PROD_DB, command, {
      user: MainDockerCompose.MARIA_DB_USERNAME,
    });
  }

  private getDumpFolderPath(): string {
    return join(MainDockerCompose.MARIA_DB_FOLDER, MainDockerCompose.MARIA_DB_DUMP_FOLDER_NAME);
  }

  private getDumpFilePath(): string {
    return join(this.getDumpFolderPath(), MainDockerCompose.MARIA_DB_DUMP_NAME);
  }

  public async prodDbIsRunning(): Promise<boolean> {
    return this.serviceIsRunning(MainComposeServiceName.GWS_CORE_PROD_DB);
  }
}
