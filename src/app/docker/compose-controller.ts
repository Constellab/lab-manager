import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';
import { UploadedFileI } from '../core/models/uploaded-file.class';
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import { DockerComposeStatusInfo } from './compose/docker-compose-inspect.class';
import { StartComposeRequestDTO, StartComposeRequestOptionsDTO } from './compose/docker-compose.dto';
import { DockerComposeService } from './compose/docker-compose.service';
import { ComposeList } from './compose/sub-compose-manager';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from './docker.class';

/**
 * Controller to manage Docker Compose operations
 * It is meant to be called by the lab using the SpaceAPIKey
 */
@Controller('docker-compose')
@LabGuard()
export class ComposeController {
  constructor(
    private readonly dockerComposeAggregateService: DockerComposeAggregateService,
    private readonly dockerComposeService: DockerComposeService
  ) {}

  //////////////////////////// ONLY FOR SUB COMPOSES ////////////////////////////
  @Post('sub-compose/:brickName/:uniqueName/register-from-file')
  @UseInterceptors(FileInterceptor('file'))
  async registerSubComposeFromFile(
    @UploadedFile() file: UploadedFileI,
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string,
    @Body() options: StartComposeRequestOptionsDTO
  ): Promise<{ message: string; output: string }> {
    const composeContent = file.buffer.toString('utf8');
    const output = await this.dockerComposeService.registerAndStartSubCompose(
      composeContent,
      options,
      brickName,
      uniqueName
    );

    return {
      message: `Sub compose ${brickName}:${uniqueName} started successfully`,
      output,
    };
  }

  @Post('sub-compose/:brickName/:uniqueName/register')
  async registerSubComposeFromString(
    @Body() body: StartComposeRequestDTO,
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<{ message: string; output: string }> {
    const output = await this.dockerComposeService.registerAndStartSubCompose(
      body.composeContent,
      body.options || {},
      brickName,
      uniqueName
    );

    return {
      message: `Sub compose ${brickName}:${uniqueName} started successfully`,
      output,
    };
  }

  @Delete('sub-compose/:brickName/:uniqueName/unregister')
  async unregisterSubCompose(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<{ message: string }> {
    const result = await this.dockerComposeService.unregisterDockerCompose(brickName, uniqueName);

    if (!result) {
      throw new Error(`Failed to delete sub compose ${brickName}:${uniqueName}`);
    }

    return {
      message: `Sub compose ${brickName}:${uniqueName} deleted successfully`,
    };
  }

  @Get('sub-compose/:brickName/:uniqueName/status')
  async getSubComposeStatus(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeService.getComposeStatus(brickName, uniqueName);
  }

  @Get('sub-compose/list')
  async getAllSubComposes(): Promise<ComposeList> {
    return this.dockerComposeService.getAllSubComposes();
  }

  //////////////////////////// FOR ALL COMPOSES (MAIN, SUB) ////////////////////////////

  @Get('list')
  listAllComposes(): ComposeList {
    return this.dockerComposeAggregateService.getAllComposes();
  }

  @Get(':brickName/:uniqueName/services')
  listServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<DockerInspect[]> {
    return this.dockerComposeAggregateService.listServices(brickName, uniqueName);
  }

  /**
   * Start a container service from docker-compose file
   * @param serviceName
   * @returns
   */
  @Put(':brickName/:uniqueName/services/:serviceName/start')
  startComposeService(
    @Param('serviceName') serviceName: string,
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.upServicesTaskCommand(brickName, uniqueName, [serviceName]);
  }

  @Post(':brickName/:uniqueName/up-services')
  async upServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string,
    @Body() options: ComposeUpOptions
  ): Promise<void> {
    return await this.dockerComposeAggregateService.upServicesTask(brickName, uniqueName, options);
  }

  @Post(':brickName/:uniqueName/restart-services')
  restartServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string,
    @Body() options: ComposeRestartOptions
  ): Promise<void> {
    return this.dockerComposeAggregateService.restartServicesTask(brickName, uniqueName, options);
  }

  @Post(':brickName/:uniqueName/stop-services')
  stopServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.stopServicesTask(brickName, uniqueName);
  }

  @Post(':brickName/:uniqueName/delete-services')
  deleteServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.deleteServicesTask(brickName, uniqueName);
  }

  @Post(':brickName/:uniqueName/pull-services')
  pullServices(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.pullServicesTask(brickName, uniqueName);
  }

  @Get(':brickName/:uniqueName/content')
  getComposeContent(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): { content: string } {
    const content = this.dockerComposeService.getComposeContent(brickName, uniqueName);
    return { content };
  }
}
