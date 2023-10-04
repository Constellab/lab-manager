import {DynamicModule, Module} from '@nestjs/common';
import {FileService} from './services/file/file.service';
import {CoreConfigService} from './services/config/core-config.service';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from './models/core-module-config.class';
import {KeyGeneratorService} from './services/key-generator/key-generator.service';
import {CommandService} from './services/command/command.service';
import {TaskService} from './services/task/task.service';
import {TraefikService} from './services/traefik/traefik.service';
import {ObjectStorageService} from './services/object-storage/object-storage.service';
import { RcloneService } from './services/rclone/rclone.service';
import { ApiService } from './services/api/api.service';
import { ExternalLabApiService } from './services/external-lab/external-lab-api.service';
import { ExternalCentralApiService } from './external-central/external-central-api.service';
import { HttpModule } from '@nestjs/axios';
import { GPUService } from './services/gpu/gpu.service';
import { ConfigFileService } from './services/config-file/config-file.service';

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
        CommandService,
        TaskService,
        TraefikService,
        ObjectStorageService,
        RcloneService,
        ApiService,
        ExternalLabApiService,
        ExternalCentralApiService,
        GPUService,
        ConfigFileService,
      ],
      exports: [
        FileService,
        CoreConfigService,
        KeyGeneratorService,
        CommandService,
        TaskService,
        TraefikService,
        ObjectStorageService,
        RcloneService,
        ApiService,
        ExternalLabApiService,
        ExternalCentralApiService,
        GPUService,
        ConfigFileService,
      ],
    };
  }
}
