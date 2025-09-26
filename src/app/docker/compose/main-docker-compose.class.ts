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

  /////////////////////////////// BIOTA ///////////////////////////////

  public deleteBiotaService(): Promise<boolean> {
    return this.downService(MainComposeServiceName.GWS_BIOTA_DB);
  }

  public async startBiotaService(): Promise<string> {
    return await this.composeUp([], [MainComposeServiceName.GWS_BIOTA_DB]);
  }

  //////////////////////// PROD DB MANAGEMENT ////////////////////////
  public async dumpProdDb(dumpLocation: string): Promise<string> {
    return await this.execCommandInService(
      MainComposeServiceName.GWS_CORE_PROD_DB,
      `sh -c "mysqldump --user='root' --password=\\$MYSQL_ROOT_PASSWORD` +
        ` --max_allowed_packet=256M \\$MYSQL_DATABASE > ${dumpLocation}"`
    );
  }

  public async restoreProdDb(dumpLocation: string): Promise<string> {
    return await this.execCommandInService(
      MainComposeServiceName.GWS_CORE_PROD_DB,
      `sh -c "mysql --user='root' --password=\\$MYSQL_ROOT_PASSWORD` +
        ` --max_allowed_packet=256M \\$MYSQL_DATABASE < ${dumpLocation}"`
    );
  }

  public async prodDbIsRunning(): Promise<boolean> {
    return this.serviceIsRunning(MainComposeServiceName.GWS_CORE_PROD_DB);
  }
}
