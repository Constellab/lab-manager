import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';
import { AuthContextService } from '../core/auth/auth-context.service';
import { DockerComposeAggregateService } from './compose/docker-compose-aggregate.service';
import {
  RegisterComposeFromZipRequestDTO,
  RegisterComposeRequestDTO,
  RegisterSQLDBComposeRequestDTO,
  RegisterSQLDBComposeResponseDTO,
} from './compose/docker-compose.dto';
import {
  ComposeList,
  ComposeStatus,
  DockerComposeUniqueId,
  DockerComposeYamlEnv,
} from './compose/docker-compose.types';
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
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env: this.getDockerComposeEnv() };
    return await this.dockerComposeAggregateService.registerAndStartSubCompose(body, composeId);
  }

  @Post(':brickName/:uniqueName/register/sqldb')
  async registerSQLDBCompose(
    @Body() body: RegisterSQLDBComposeRequestDTO,
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<RegisterSQLDBComposeResponseDTO> {
    const composeId: DockerComposeUniqueId = { brickName, uniqueName, env: this.getDockerComposeEnv() };
    return await this.dockerComposeAggregateService.registerSQLDBCompose(composeId, body);
  }

  @Post(':brickName/:uniqueName/register-from-zip')
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
      {
        brickName,
        uniqueName,
        env: this.getDockerComposeEnv(),
      },
      file.buffer,
      body
    );
  }

  @Delete(':brickName/:uniqueName/unregister')
  async unregisterSubCompose(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<ComposeStatus> {
    return await this.dockerComposeAggregateService.unregisterSubCompose({
      brickName,
      uniqueName,
      env: this.getDockerComposeEnv(),
    });
  }

  @Get(':brickName/:uniqueName/status')
  async getSubComposeStatus(
    @Param('brickName', DockerNameValidationPipe) brickName: string,
    @Param('uniqueName', DockerNameValidationPipe) uniqueName: string
  ): Promise<ComposeStatus> {
    return await this.dockerComposeAggregateService.getComposeStatus({
      brickName,
      uniqueName,
      env: this.getDockerComposeEnv(),
    });
  }

  @Get('list')
  async getAllSubComposes(): Promise<ComposeList> {
    return this.dockerComposeAggregateService.getAllSubComposes();
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
