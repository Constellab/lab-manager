import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ExternalCommunityApiService } from '../core/services/external/external-community-api.service';
import { BrickVersionDTO } from '../core/services/external/external-community.class';

/**
 * Expose community routes with this controller
 */
@Controller('community')
export class CommunityController {
  constructor(private communityService: ExternalCommunityApiService) {}

  @Get('brick/:name/version/:version')
  async getCurrentTask(
    @Param('name') name: string,
    @Param('version') version: string
  ): Promise<BrickVersionDTO> {
    return this.communityService.getBrickInfos(name, version);
  }

  @Post('brick')
  async getAllWithFilters(
    @Body() filter: any,
    @Query('page', ParseIntPipe) page: number,
    @Query('size', ParseIntPipe) size: number
  ): Promise<any> {
    return this.communityService.getAllWithFilters(filter, page, size);
  }

  @Get('brick/:name')
  async getByName(@Param('name') name: string): Promise<any> {
    return this.communityService.getByName(name);
  }

  @Get('brick/:id/version')
  async getVersionsList(@Param('id') id: string): Promise<string[]> {
    return this.communityService.getVersionsList(id);
  }
}
