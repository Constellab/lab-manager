import {Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';

/*  eslint-disable max-len */
/**
 * Mock service for the DockerCommandService
 */
@Injectable()
export class DockerCommandMock implements DockerCommandServiceI {
  composeDown(): Promise<string> {
    return Promise.resolve('');
  }

  composeUp(): Promise<string> {
    return Promise.resolve('');
  }

  dockerPs(): Promise<string> {
    return Promise.resolve(`{"Command":"\\"docker-entrypoint.sh mariadbd\\"","CreatedAt":"2021-12-17 10:29:24 +0100 CET","ID":"fc3ed3aee6c83a0519157c14fda365258e274d77250b1a78dc06ed7ef2a634eb","Image":"mariadb:10","Labels":"com.docker.compose.oneoff=False,com.docker.compose.project=local,com.docker.compose.version=2.2.1,com.docker.compose.config-hash=ef9f99fb045c0056fef4fe0158fbb38cbb3f1d2ebd9279cd66c400523a523a02,com.docker.compose.container-number=1,com.docker.compose.depends_on=,com.docker.compose.service=gws_biota_dev_db,com.docker.compose.image=sha256:e2278f24ac88b82f98ef58de4bf15c0b01df3de2f1fe835e2ea4350282d58700,com.docker.compose.project.config_files=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local\\\\docker-compose.yml,com.docker.compose.project.working_dir=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local","LocalVolumes":"1","Mounts":"0859e5c804f915c5c882895f2ad8eedc9810dae07e3d2d2c622b3f829cae0f2d","Names":"local_gws_biota_dev_db_1","Networks":"local_gencovery-network","Ports":"0.0.0.0:3309-\u003e3306/tcp","RunningFor":"12 days ago","Size":"2B (virtual 410MB)","State":"running","Status":"Up 3 hours"},
{"Command":"\\"docker-entrypoint.sh mariadbd\\"","CreatedAt":"2021-12-17 10:24:28 +0100 CET","ID":"66c07cd4715b6da0a59fbd0e6ed018e0a2be4ff0b31cdac225939122158028f4","Image":"mariadb:10","Labels":"com.docker.compose.config-hash=52178f2fe9215d2860715cb502ac6510f46d87039bb93f2b74b47ccc93b271fa,com.docker.compose.project.working_dir=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local,com.docker.compose.service=gws_core_dev_db,com.docker.compose.container-number=1,com.docker.compose.depends_on=,com.docker.compose.image=sha256:e2278f24ac88b82f98ef58de4bf15c0b01df3de2f1fe835e2ea4350282d58700,com.docker.compose.oneoff=False,com.docker.compose.project=local,com.docker.compose.project.config_files=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local\\\\docker-compose.yml,com.docker.compose.version=2.2.1","LocalVolumes":"1","Mounts":"be798348599047745ae571a828e26723829e6f0a8fd9d4267d2795ce87555800","Names":"local_gws_core_dev_db_1","Networks":"local_gencovery-network","Ports":"0.0.0.0:3307-\u003e3306/tcp","RunningFor":"12 days ago","Size":"2B (virtual 410MB)","State":"running","Status":"Up 3 hours"},
{"Command":"\\"docker-entrypoint.sh mariadbd\\"","CreatedAt":"2021-11-25 18:49:57 +0100 CET","ID":"1037cf73f9f0493901b6c454cfa67c2efbcf5b7c0bc9b136b15c1b7ff393b817","Image":"mariadb:10","Labels":"com.docker.compose.depends_on=,com.docker.compose.image=sha256:e2278f24ac88b82f98ef58de4bf15c0b01df3de2f1fe835e2ea4350282d58700,com.docker.compose.project=local,com.docker.compose.project.config_files=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local\\\\docker-compose.yml,com.docker.compose.project.working_dir=C:\\\\Users\\\\benji\\\\Documents\\\\Project\\\\Gencovery\\\\dockerlab\\\\docker-compose\\\\local,com.docker.compose.version=2.1.1,com.docker.compose.config-hash=7f12f38b1e0e7e82ad544cdd7f2488f6d79e9230447c2e9eba1144fa258d50ad,com.docker.compose.container-number=1,com.docker.compose.oneoff=False,com.docker.compose.service=test_gws_dev_db","LocalVolumes":"1","Mounts":"b8acb6b7450f3adc62b3ede67237d313f060d13362f844d0e26bff3176184f6d","Names":"local-test_gws_dev_db-1","Networks":"local_gencovery-network","Ports":"0.0.0.0:3308-\u003e3306/tcp","RunningFor":"4 weeks ago","Size":"2B (virtual 410MB)","State":"running","Status":"Up 3 hours"},
`);
  }

  getLogs(): Promise<string> {
    return Promise.resolve('INFO:     Started server process [1]\n' +
      'INFO:     Waiting for application startup.\n' +
      'INFO - 2022-01-03 11:50:26.794137 -  The queue is initialized and active\n' +
      'INFO:     Application startup complete.\n' +
      'INFO:     Uvicorn running on http://0.0.0.0:3000 (Press CTRL+C to quit)');
  }

  login(): Promise<string> {
    return Promise.resolve('');
  }



}