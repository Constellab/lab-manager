import {Injectable} from '@nestjs/common';
import {Brick} from './brick.class';
import {ConfigFile} from '../core/model/config-file.class';
import {FileService} from '../core/service/file/file.service';

@Injectable()
export class BrickService {

  constructor(private fileService: FileService) {
  }

  public async getBricks(): Promise<Brick[]> {
    const config: ConfigFile = this.fileService.readConfigFile();

    const bricks: Brick[] = [];

    for(const pipEnv of config.environment.pip){
      for(const brick of pipEnv.packages){
        if (brick.is_brick) {
          bricks.push({
            name: brick.name,
            type: 'pip',
            version: brick.version,
            source: pipEnv.source
          });
        }
      }
    }

    // add git bricks
    for (const gitEnv of config.environment.git) {
      for (const brick of gitEnv.packages) {
        if (brick.is_brick) {
          bricks.push({
            name: brick.name,
            type: 'git',
            branch: brick.branch,
            commit: brick.commit,
            source: gitEnv.source
          });
        }
      }
    }

    return bricks;
  }
}
