import {format, transports} from 'winston';
import {WinstonModuleOptions} from 'nest-winston';
import {TransformableInfo} from 'logform';
import 'winston-daily-rotate-file';
import {LogLevel} from '@nestjs/common/services/logger.service';

export interface LoggerConfig{
  logLevel: LogLevel;
  logFilePath: string; // if provided, a daily log file is created
}

/**
 * Method to configure the logger using winston
 *
 * In prod, it logs the in the console and in a daily file
 * @param config
 */
export function configureLogger(config: LoggerConfig): WinstonModuleOptions {

  const transportsList: any[] = [];

  const dataFormat: string = 'DD/MM/YY HH:mm:ss';
  const logFormat = (info: TransformableInfo): string => `${info.timestamp} ${info.level} [${info.context}]: ${info.message}`;

  // Add the console transport to log into the console
  transportsList.push(new transports.Console({
    level: config.logLevel,
    format: format.combine(
      format.timestamp({format: dataFormat}),
      format.colorize(),
      format.printf(logFormat)
    )
  }));

  // add the file transport to log into a file with rotation
  if (config.logFilePath) {
    // by default, it create a new log file each day
    transportsList.push(new transports.DailyRotateFile({
      level: config.logLevel,
      dirname: config.logFilePath,
      filename: `%DATE%`, // filename is the current date YYYY-MM-DD
      extension: '.log',
      format: format.combine(
        format.timestamp({format: dataFormat}),
        format.printf(logFormat)
      ),
    }));
  }

  return {
    level: config.logLevel,
    transports: transportsList
  };
}
