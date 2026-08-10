import { Test, TestingModule } from '@nestjs/testing';
import { DockerContainerService } from './container/docker-container.service';
import { LogSearchResult } from './container/log-search.dto';
import { DockerContainersController } from './docker-containers.controller';
import { LogSearchQueryPipe } from './pipes/log-search-query.pipe';

describe('DockerContainersController', () => {
  let controller: DockerContainersController;

  const emptyResult: LogSearchResult = {
    logs: '',
    returnedLines: 0,
    matchedLines: 0,
    totalLines: 0,
    truncated: false,
    window: { from: null, to: null },
  };

  const dockerContainerService = {
    searchLogs: jest.fn().mockResolvedValue(emptyResult),
    getLogs: jest.fn().mockResolvedValue('raw logs'),
    getErrorLogs: jest.fn().mockResolvedValue('raw error logs'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DockerContainersController],
      providers: [{ provide: DockerContainerService, useValue: dockerContainerService }],
    }).compile();

    controller = module.get<DockerContainersController>(DockerContainersController);
  });

  describe('logs/search', () => {
    it('should hand the parameters validated by the pipe to the service', async () => {
      const params = new LogSearchQueryPipe().transform({ pattern: 'BOOM', tail: '50' });

      expect(await controller.searchLogs('glab', params)).toBe(emptyResult);
      expect(dockerContainerService.searchLogs).toHaveBeenCalledWith('glab', params);
    });
  });

  describe('the routes the web console consumes', () => {
    it('should leave /logs and /logs/error untouched', async () => {
      expect(await controller.getLogs('glab')).toEqual({ logs: 'raw logs' });
      expect(await controller.getErrorLogs('glab')).toEqual({ logs: 'raw error logs' });
      expect(dockerContainerService.getLogs).toHaveBeenCalledWith('glab');
      expect(dockerContainerService.getErrorLogs).toHaveBeenCalledWith('glab');
    });
  });
});
