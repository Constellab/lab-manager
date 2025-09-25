import { DynamicModule, Module } from '@nestjs/common';
import { FileService } from './services/file/file.service';
import { CoreConfigService } from './services/config/core-config.service';
import { CORE_MODULE_PROVIDER, CoreModuleConfig } from './models/core-module-config.class';
import { KeyGeneratorService } from './services/key-generator/key-generator.service';
import { TaskService } from './services/task/task.service';
import { TraefikService } from './services/traefik/traefik.service';
import { RcloneService } from './services/rclone/rclone.service';
import { ApiService } from './services/api/api.service';
import { ExternalLabApiService } from './services/external/external-lab-api.service';
import { ExternalSpaceApiService } from './services/external/external-space-api.service';
import { HttpModule } from '@nestjs/axios';
import { GPUService } from './services/gpu/gpu.service';
import { ConfigFileService } from './services/config-file/config-file.service';
import { ExternalCommunityApiService } from './services/external/external-community-api.service';

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
        TraefikService,
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
        TraefikService,
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
