import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LabGuard } from 'src/app/core/decorators/lab-guard.decorator';
import { UploadedFileI } from '../core/models/uploaded-file.class';
import { DockerComposeStatusInfo } from './compose/docker-compose-inspect.class';
import { StartComposeRequestDTO } from './compose/docker-compose.dto';
import { DockerComposeService } from './compose/docker-compose.service';
import { SubComposeList } from './compose/sub-compose-manager';

/**
 * Controller to manage Docker Compose operations
 * It is meant to be called by the lab using the SpaceAPIKey
 */
@Controller('docker')
@LabGuard()
export class DockerController {
  constructor(private readonly dockerComposeService: DockerComposeService) {}

  @Post('compose/:brickName/:uniqueName/start-from-file')
  @UseInterceptors(FileInterceptor('file'))
  async startComposeFromFile(
    @UploadedFile() file: UploadedFileI,
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<{ message: string; output: string }> {
    const composeContent = file.buffer.toString('utf8');
    const output = await this.dockerComposeService.startSubCompose(composeContent, brickName, uniqueName);

    return {
      message: `Sub compose ${brickName}:${uniqueName} started successfully`,
      output,
    };
  }

  @Post('compose/:brickName/:uniqueName/start')
  async startComposeFromString(
    @Body() body: StartComposeRequestDTO,
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<{ message: string; output: string }> {
    const output = await this.dockerComposeService.startSubCompose(
      body.composeContent,
      brickName,
      uniqueName
    );

    return {
      message: `Sub compose ${brickName}:${uniqueName} started successfully`,
      output,
    };
  }

  @Delete('compose/:brickName/:uniqueName/delete')
  async deleteCompose(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<{ message: string }> {
    const result = await this.dockerComposeService.deleteDockerCompose(brickName, uniqueName);

    if (!result) {
      throw new Error(`Failed to delete sub compose ${brickName}:${uniqueName}`);
    }

    return {
      message: `Sub compose ${brickName}:${uniqueName} deleted successfully`,
    };
  }

  @Get('compose/:brickName/:uniqueName/status')
  async getComposeStatus(
    @Param('brickName') brickName: string,
    @Param('uniqueName') uniqueName: string
  ): Promise<DockerComposeStatusInfo> {
    return await this.dockerComposeService.getSubComposeStatus(brickName, uniqueName);
  }

  @Get('compose/list')
  async getAllComposes(): Promise<SubComposeList> {
    return this.dockerComposeService.getAllSubComposes();
  }
}
