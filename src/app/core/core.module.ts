import {DynamicModule, Module} from '@nestjs/common';
import {FileService} from './service/file/file.service';
import {InitService} from './service/init/init.service';
import {CoreConfigService} from './service/config/core-config.service';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from './model/core-module-config.class';
import {KeyGeneratorService} from './service/key-generator/key-generator.service';
import {DockerCommandService} from './service/docker-command/docker-command.service';

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
