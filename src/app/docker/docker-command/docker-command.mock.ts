import {Injectable} from '@nestjs/common';
import {DockerCommandServiceI} from './docker-command.class';
import { DockerPsFull, DockerRunOptions } from '../docker.class';

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

  composePull(): Promise<string> {
    return Promise.resolve('');
  }

  getContainerInfo(containerName: string): Promise<DockerPsFull> {
    return Promise.resolve(
      {
        'id': '4f8364e6037b348a9eff4768cf9694d6490c803923433326cac87ee6a5ee61e9',
        'command': '/entrypoint.sh --run-codelab',
        'createdAt': '2022-01-04 17:42:12 +0100 CET',
        'image': 'constellab/codelab:latest',
        'mounts': '',
        'names': 'codelab',
        'networks': 'gencovery-network-dev',
        'ports': '3000/tcp, 8080/tcp',
        'runningFor': '2 days ago',
        'size': '4.03kB (virtual 8.01GB)',
        'state': 'exited',
        'status': 'Exited (255) 26 hours ago'
      });
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

  systemPrune(): Promise<string> {
    return Promise.resolve('');
  }

  dockerRun(image: string, containerName: string, options?: DockerRunOptions): Promise<boolean> {
    return Promise.resolve(false);
  }



}