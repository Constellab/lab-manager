import {Module} from '@nestjs/common';
import {CoreModule} from './app/core/core.module';
import {join} from 'path';
import {ConfigModule} from '@nestjs/config';
import {CoreConfigService} from './app/core/service/config/core-config.service';
import {WinstonModule, WinstonModuleOptions} from 'nest-winston';
import {configureLogger, LoggerConfig} from './app/core/model/logger.class';
import {APP_GUARD} from '@nestjs/core';
import {ApiKeyGuard} from './app/core/guard/api-key.guard';
import { AppController } from './app.controller';
import { DockerModule } from './app/docker/docker.module';
import {BrickModule} from './app/brick/brick.module';

function configureWinstonLogger(configService: CoreConfigService): WinstonModuleOptions {
  const logConfig: LoggerConfig = {
    logLevel: configService.getLogLevel(),
    logFilePath: configService.isLocal() ? null : configService.getLogPath()
  };
  return configureLogger(logConfig);
}

@Module({
  imports: [
    // let the config module on top of the imports
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, 'environments', 'dev.env'),
    }),

    CoreModule.forRoot({distFolder: __dirname}),

    // set up the logging module
    WinstonModule.forRootAsync({
      imports: [CoreModule],
      useFactory: configureWinstonLogger,
      inject: [CoreConfigService],
    }),

    DockerModule,
    BrickModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {
}
