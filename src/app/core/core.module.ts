import {DynamicModule, Module} from '@nestjs/common';
import {FileService} from './services/file/file.service';
import {InitService} from './services/init/init.service';
import {CoreConfigService} from './services/config/core-config.service';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from './models/core-module-config.class';
import {KeyGeneratorService} from './services/key-generator/key-generator.service';
import {DockerCommandService} from './services/docker-command/docker-command.service';

@Module({
  providers: [
  ],
})
export class CoreModule {

  public static forRoot(config: CoreModuleConfig): DynamicModule {
    return {
      global: true,
      module: CoreModule,
      providers: [
        {
          provide: CORE_MODULE_PROVIDER,
          useValue: config,
        },
        FileService,
        InitService,
        CoreConfigService,
        KeyGeneratorService,
        DockerCommandService,
      ],
      exports: [
        FileService,
        InitService,
        CoreConfigService,
        KeyGeneratorService,
        DockerCommandService,

      ]
    };
  }
}
