import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CoreConfigService } from '../../core/services/config/core-config.service';
import { TaskService } from '../../core/services/task/task.service';
import { DockerCommand, StreamLogsOptions, StreamLogsOutcome } from '../docker-command.class';
import { DockerContainerService } from './docker-container.service';
import { parseLogSearchQuery } from './log-search-params';

describe('DockerContainerService.searchLogs', () => {
  let service: DockerContainerService;

  /** Feeds the lines a container would have written, in place of a real `docker logs`. */
  const givenLogs = (
    lines: { text: string; stream?: 'stdout' | 'stderr' }[],
    outcome: Partial<StreamLogsOutcome> = {}
  ): void => {
    jest
      .spyOn(DockerCommand.prototype, 'streamLogs')
      .mockImplementation(async (_containerName: string, options: StreamLogsOptions) => {
        for (const line of lines) {
          if (!options.onLine(line.text, line.stream ?? 'stdout')) break;
        }
        return { timedOut: false, exitCode: 0, ...outcome };
      });
  };

  const line = (second: number, message: string): string =>
    `2026-08-10T09:00:${String(second).padStart(2, '0')}.000000000Z ${message}`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerContainerService,
        { provide: TaskService, useValue: {} },
        { provide: CoreConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<DockerContainerService>(DockerContainerService);
    jest.spyOn(DockerCommand.prototype, 'containerExists').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should read the whole window and filter it here, not on the caller side', async () => {
    givenLogs([
      { text: line(1, 'BOOM the interesting line') },
      { text: line(2, 'noise') },
      { text: line(3, 'noise') },
    ]);

    const result = await service.searchLogs('glab', parseLogSearchQuery({ pattern: 'BOOM', tail: '1' }));

    expect(result.logs).toBe(line(1, 'BOOM the interesting line'));
    expect(result.totalLines).toBe(3);
    expect(result.matchedLines).toBe(1);
    expect(result.returnedLines).toBe(1);
    expect(result.window).toEqual({
      from: '2026-08-10T09:00:01.000000000Z',
      to: '2026-08-10T09:00:03.000000000Z',
    });
  });

  it('should always ask docker for timestamps and pass the time bounds along', async () => {
    givenLogs([]);

    await service.searchLogs('glab', parseLogSearchQuery({ since: '1d', until: '2026-08-10T09:00:00Z' }));

    const options = jest.mocked(DockerCommand.prototype.streamLogs).mock.calls[0][1];
    expect(options.since).toBe('24h');
    expect(options.until).toBe('2026-08-10T09:00:00Z');
  });

  it('should report a timeout raised while reading docker logs', async () => {
    givenLogs([{ text: line(1, 'collected') }], { timedOut: true });

    const result = await service.searchLogs('glab', parseLogSearchQuery({}));

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('timeout');
    expect(result.logs).toBe(line(1, 'collected'));
  });

  it('should not answer an unreadable log as an empty one', async () => {
    // a logging driver docker cannot read : answering `logs: ""` would let the caller conclude the
    // container said nothing
    givenLogs([], { exitCode: 1 });

    const error = await service.searchLogs('glab', parseLogSearchQuery({})).catch((e) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse().message).toContain('glab');
    expect(error.getResponse().message).toContain('logging driver');
  });

  it('should keep the lines it did read when docker fails at the end', async () => {
    givenLogs([{ text: line(1, 'read before the failure') }], { exitCode: 1 });

    const result = await service.searchLogs('glab', parseLogSearchQuery({}));

    expect(result.logs).toBe(line(1, 'read before the failure'));
  });

  it('should answer 404 with the containers that do exist', async () => {
    jest.spyOn(DockerCommand.prototype, 'containerExists').mockResolvedValue(false);
    jest.spyOn(DockerCommand.prototype, 'listContainerNames').mockResolvedValue(['glab', 'codelab']);

    const error = await service.searchLogs('gla', parseLogSearchQuery({})).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.getResponse()).toEqual({
      message: `Container 'gla' does not exist on this lab.`,
      containerName: 'gla',
      existingContainers: ['glab', 'codelab'],
    });
  });

  it('should refuse a name docker itself would refuse, without running any command', async () => {
    const containerExists = jest.spyOn(DockerCommand.prototype, 'containerExists');
    jest.spyOn(DockerCommand.prototype, 'listContainerNames').mockResolvedValue(['glab']);

    const error = await service.searchLogs('glab; rm -rf /', parseLogSearchQuery({})).catch((e) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect(containerExists).not.toHaveBeenCalled();
  });
});
