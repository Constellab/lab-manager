import {Module} from '@nestjs/common';
import {CoreModule} from './app/core/core.module';
import {join} from 'path';
import {ConfigModule} from '@nestjs/config';
import {CoreConfigService} from './app/core/services/config/core-config.service';
import {WinstonModule, WinstonModuleOptions} from 'nest-winston';
import {configureLogger, LoggerConfig} from './app/core/models/logger.class';
import {APP_FILTER, APP_GUARD} from '@nestjs/core';
import {ApiKeyGuard} from './app/core/guards/api-key.guard';
import {AppController} from './app.controller';
import {DockerModule} from './app/docker/docker.module';
import {BrickModule} from './app/brick/brick.module';
import {CoreExceptionHandlerFilter} from './app/core/filters/core-exception-handler.filter';

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
    // set global exception handler
    {
      provide: APP_FILTER,
      useClass: CoreExceptionHandlerFilter,
    },

  ],
})
export class AppModule {
}
