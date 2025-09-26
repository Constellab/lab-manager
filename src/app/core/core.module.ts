import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import { CORE_MODULE_PROVIDER, CoreModuleConfig } from './models/core-module-config.class';
import { ApiService } from './services/api/api.service';
import { ConfigFileService } from './services/config-file/config-file.service';
import { CoreConfigService } from './services/config/core-config.service';
import { ExternalCommunityApiService } from './services/external/external-community-api.service';
import { ExternalLabApiService } from './services/external/external-lab-api.service';
import { ExternalSpaceApiService } from './services/external/external-space-api.service';
import { FileService } from './services/file/file.service';
import { GPUService } from './services/gpu/gpu.service';
import { KeyGeneratorService } from './services/key-generator/key-generator.service';
import { RcloneService } from './services/rclone/rclone.service';
import { TaskService } from './services/task/task.service';

@Module({
  providers: [],
})
export class CoreModule {
  public static forRoot(config: CoreModuleConfig): DynamicModule {
    return {
      global: true,
      module: CoreModule,
      imports: [HttpModule],
      providers: [
        {
          provide: CORE_MODULE_PROVIDER,
          useValue: config,
        },
        FileService,
        CoreConfigService,
        KeyGeneratorService,
        TaskService,
        RcloneService,
        ApiService,
        ExternalLabApiService,
        ExternalSpaceApiService,
        ExternalCommunityApiService,
        GPUService,
        ConfigFileService,
      ],
      exports: [
        FileService,
        CoreConfigService,
        KeyGeneratorService,
        TaskService,
        RcloneService,
        ApiService,
        ExternalLabApiService,
        ExternalSpaceApiService,
        ExternalCommunityApiService,
        GPUService,
        ConfigFileService,
      ],
    };
  }
}
