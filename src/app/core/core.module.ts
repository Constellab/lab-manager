import {DynamicModule, Module} from '@nestjs/common';
import {FileService} from './services/file/file.service';
import {CoreConfigService} from './services/config/core-config.service';
import {CORE_MODULE_PROVIDER, CoreModuleConfig} from './models/core-module-config.class';
import {KeyGeneratorService} from './services/key-generator/key-generator.service';
import {DockerCommandService} from './services/docker-command/docker-command.service';
import {BiotaService} from './services/biota/biota.service';
import {CommandService} from './services/command/command.service';
import {TaskService} from './services/task/task.service';
import {EnvVariableService} from './services/env-variable/env-variable.service';

@Module({
  providers: [],
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
        CoreConfigService,
        KeyGeneratorService,
        DockerCommandService,
        BiotaService,
        CommandService,
        TaskService,
        EnvVariableService,
      ],
      exports: [
        FileService,
        CoreConfigService,
        KeyGeneratorService,
        DockerCommandService,
        BiotaService,
        CommandService,
        TaskService,
        EnvVariableService,
      ]
    };
  }
}
