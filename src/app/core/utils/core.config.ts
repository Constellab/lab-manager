import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function getLocalCors(): CorsOptions {  
  return {
    origin: [/^(.*)/], // use regex instead of simple '*'
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: false,
  };
}
