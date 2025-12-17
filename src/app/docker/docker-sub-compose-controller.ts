import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';
import { AuthContextService } from '../core/auth/auth-context.service';
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import {
  RegisterComposeRequestDTO,
  RegisterComposeRequestOptionsDTO,
  RegisterSQLDBComposeRequestDTO,
  RegisterSQLDBComposeResponseDTO,
} from './compose/docker-compose.dto';
import {
  ComposeList,
  ComposeStatus,
  DockerComposeUniqueId,
  DockerComposeYamlEnv,
} from './compose/docker-compose.types';
import { DockerInspect } from './docker.class';
import { DockerNameValidationPipe } from './pipes/docker-name-validation.pipe';
import { JsonParsePipe } from './pipes/json-parse.pipe';

/**
 * Controller to manage Docker Sub Compose operations
 * It is meant to be called by the lab using the SpaceAPIKey
 */
@Controller('sub-compose')
@LabGuard()
export class DockerSubComposeController {
  constructor(private readonly dockerComposeAggregateService: DockerComposeAggregateService) {}

  //////////////////////////// ONLY FOR SUB COMPOSES ////////////////////////////

  @Post(':brickName/:uniqueName/register')
  async registerSubComposeFromString(
    @Body() body: RegisterComposeRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    const composeId: DockerComposeUniqueId = this.getComposeId(brickName, uniqueName);
    return await this.dockerComposeAggregateService.registerAndStartSubCompose(body, composeId);
  }

  @Post(':brickName/:uniqueName/register/sqldb')
  async registerSQLDBCompose(
    @Body() body: RegisterSQLDBComposeRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<RegisterSQLDBComposeResponseDTO> {
    const composeId: DockerComposeUniqueId = this.getComposeId(brickName, uniqueName);
    return await this.dockerComposeAggregateService.registerSQLDBCompose(composeId, body);
  }

  @Post(':brickName/:uniqueName/register-from-zip')
  @UseInterceptors(FileInterceptor('file'))
  async registerSubComposeFromZip(
    @UploadedFile() file: Express.Multer.File,
    @Body('body', JsonParsePipe) body: RegisterComposeRequestOptionsDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<void> {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const composeId = this.getComposeId(brickName, uniqueName);

    return await this.dockerComposeAggregateService.registerSubComposeFromZip(composeId, file.buffer, body);
  }

  @Delete(':brickName/:uniqueName/unregister')
  async unregisterSubCompose(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<ComposeStatus> {
    const composeId = this.getComposeId(brickName, uniqueName);
    return await this.dockerComposeAggregateService.unregisterSubCompose(composeId);
  }

  @Get(':brickName/:uniqueName/status')
  async getSubComposeStatus(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<ComposeStatus> {
    const composeId = this.getComposeId(brickName, uniqueName);
    return await this.dockerComposeAggregateService.getComposeStatus(composeId);
  }

  @Get(':brickName/:uniqueName/service/:serviceName/status')
  async getSubComposeServiceStatus(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string,
    @Param('serviceName', DockerNameValidationPipe) serviceName: string
  ): Promise<DockerInspect> {
    const composeId = this.getComposeId(brickName, uniqueName);
    return await this.dockerComposeAggregateService.getSubComposeServiceStatus(composeId, serviceName);
  }

  @Get('list')
  async getAllSubComposes(): Promise<ComposeList> {
    return this.dockerComposeAggregateService.getAllSubComposes();
  }

  private getComposeId(
    brickName: string,
    uniqueName: string,
    env?: DockerComposeYamlEnv
  ): DockerComposeUniqueId {
    if (env === 'none') {
      env = null;
    }
    return {
      brickName,
      uniqueName,
      env: env ?? this.getDockerComposeEnv(),
    };
  }

  private getDockerComposeEnv(): DockerComposeYamlEnv {
    // Determine the context based on the authentication
    const authContext = AuthContextService.getContext();
    if (authContext?.type === 'local') return 'dev'; // Local can access all for testing purposes
    if (!authContext || authContext.type !== 'lab') {
      throw new Error('This endpoint can only be called by a lab');
    }
    return authContext.env === 'prod' ? 'prod' : 'dev';
  }
}
