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
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import { DockerComposeStatusInfo } from './compose/docker-compose-inspect.class';
import {
  RegisterComposeFromZipRequestDTO,
  RegisterComposeRequestDTO,
  RegisterSQLDBComposeRequestDTO,
  RegisterSQLDBComposeResponseDTO,
} from './compose/docker-compose.dto';
import { ComposeList } from './compose/sub-compose-manager';
import { ComposeRestartOptions, ComposeUpOptions, DockerInspect } from './docker.class';
import { DockerNameValidationPipe } from './pipes/docker-name-validation.pipe';
import { JsonParsePipe } from './pipes/json-parse.pipe';

/**
 * Controller to manage Docker Compose operations
 * It is meant to be called by the lab using the SpaceAPIKey
 */
@Controller('docker-compose')
@LabGuard()
export class DockerComposeController {
  constructor(private readonly dockerComposeAggregateService: DockerComposeAggregateService) {}

  //////////////////////////// ONLY FOR SUB COMPOSES ////////////////////////////

  @Post('sub-compose/:brickName/:uniqueName/register')
  async registerSubComposeFromString(
    @Body() body: RegisterComposeRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    return await this.dockerComposeAggregateService.registerAndStartSubCompose(body, brickName, uniqueName);
  }

  @Post('sub-compose/:brickName/:uniqueName/register/sqldb')
  async registerSQLDBCompose(
    @Body() body: RegisterSQLDBComposeRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<RegisterSQLDBComposeResponseDTO> {
    return await this.dockerComposeAggregateService.registerSQLDBCompose(brickName, uniqueName, body);
  }

  @Post('sub-compose/:brickName/:uniqueName/register-from-zip')
  @UseInterceptors(FileInterceptor('file'))
  async registerSubComposeFromZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('body', JsonParsePipe) body: RegisterComposeFromZipRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    if (!body.description) {
      throw new Error('Description is required');
    }

    return await this.dockerComposeAggregateService.registerSubComposeFromZip(
      brickName,
      uniqueName,
      file.buffer,
      body
    );
  }

  @Delete('sub-compose/:brickName/:uniqueName/unregister')
  async unregisterSubCompose(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeAggregateService.unregisterSubCompose(brickName, uniqueName);
  }

  @Get('sub-compose/:brickName/:uniqueName/status')
  async getSubComposeStatus(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeAggregateService.getSubComposeStatus(brickName, uniqueName);
  }

  @Get('sub-compose/list')
  async getAllSubComposes(): Promise<ComposeList> {
    return this.dockerComposeAggregateService.getAllSubComposes();
  }

  //////////////////////////// FOR ALL COMPOSES (MAIN, SUB) ////////////////////////////

  @Get('list')
  listAllComposes(): ComposeList {
    return this.dockerComposeAggregateService.getAllComposes();
  }

  @Get(':brickName/:uniqueName/services')
  listServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
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
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.upServicesTaskCommand(brickName, uniqueName, [serviceName]);
  }

  @Post(':brickName/:uniqueName/up-services')
  async upServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Body() options: ComposeUpOptions
  ): Promise<void> {
    return await this.dockerComposeAggregateService.upServicesTask(brickName, uniqueName, options);
  }

  @Post(':brickName/:uniqueName/restart-services')
  restartServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Body() options: ComposeRestartOptions
  ): Promise<void> {
    return this.dockerComposeAggregateService.restartServicesTask(brickName, uniqueName, options);
  }

  @Post(':brickName/:uniqueName/stop-services')
  stopServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.stopServicesTask(brickName, uniqueName);
  }

  @Post(':brickName/:uniqueName/delete-services')
  deleteServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.deleteServicesTask(brickName, uniqueName);
  }

  @Post(':brickName/:uniqueName/pull-services')
  pullServices(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    return this.dockerComposeAggregateService.pullServicesTask(brickName, uniqueName);
  }

  @Get(':brickName/:uniqueName/content')
  getComposeContent(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): { content: string } {
    const content = this.dockerComposeAggregateService.getComposeContent(brickName, uniqueName);
    return { content };
  }
}
