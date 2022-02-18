import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {WINSTON_MODULE_NEST_PROVIDER} from 'nest-winston';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = 3010;

  // enable custom logger using winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/');
  });
}

bootstrap();
