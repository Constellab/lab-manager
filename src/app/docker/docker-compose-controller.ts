import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import { DockerComposeStatusInfo } from './compose/docker-compose-inspect.class';
import { ComposeList, DockerComposeUniqueId, DockerComposeYamlEnv } from './compose/docker-compose.types';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from './docker.class';
import { DockerNameValidationPipe } from './pipes/docker-name-validation.pipe';

/**
 * Controller to manage Docker Compose operations
 * It is meant to be called by the Space
 */
@Controller('docker-compose')
@LabGuard()
export class DockerComposeController {
  constructor(private readonly dockerComposeAggregateService: DockerComposeAggregateService) {}

  @Get('list')
  listAllComposes(): ComposeList {
    return this.dockerComposeAggregateService.getAllComposes();
  }

  @Get(':brickName/:uniqueName/:env/services')
  listServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<DockerInspect[]> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.listServices(composeId);
  }

  /**
   * Start a container service from docker-compose file
   * @param serviceName
   * @returns
   */
  @Put(':brickName/:uniqueName/:env/services/:serviceName/start')
  startComposeService(
    @Param('serviceName') serviceName: string,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.upServicesTaskCommand(composeId, [serviceName]);
  }

  @Post(':brickName/:uniqueName/:env/up-services')
  async upServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv,
    @Body() options: ComposeUpOptions
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return await this.dockerComposeAggregateService.upServicesTask(composeId, options);
  }

  @Post(':brickName/:uniqueName/:env/restart-services')
  restartServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv,
    @Body() options: ComposeRestartOptions
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.restartServicesTask(composeId, options);
  }

  @Post(':brickName/:uniqueName/:env/stop-services')
  stopServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.stopServicesTask(composeId);
  }

  @Post(':brickName/:uniqueName/:env/delete-services')
  deleteServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.deleteServicesTask(composeId);
  }

  @Post(':brickName/:uniqueName/:env/pull-services')
  pullServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return this.dockerComposeAggregateService.pullServicesTask(composeId);
  }

  @Get(':brickName/:uniqueName/:env/content')
  getComposeContent(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): { content: string } {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    const content = this.dockerComposeAggregateService.getComposeContent(composeId);
    return { content };
  }

  @Delete(':brickName/:uniqueName/:env/unregister')
  async unregisterSubCompose(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('env') env: DockerComposeYamlEnv
  ): Promise<DockerComposeStatusInfo> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env };
    return await this.dockerComposeAggregateService.unregisterSubCompose(composeId);
  }
}
