import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { getLocalCors, getPrivateCloudCors } from './app/core/utils/core.config';
import { EnvironmentProfile } from './app/core/models/config.class';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env['PORT']);

  // enable cors
  const env: EnvironmentProfile = process.env['ENVIRONMENT_PROFILE'] as EnvironmentProfile;
  if (env === 'dev' || env === 'desktop' || env === 'test') {
    app.enableCors(getLocalCors());
  } else if (env === 'private-cloud') {
    // The standalone front lives on a different subdomain than the API.
    app.enableCors(getPrivateCloudCors(process.env['VIRTUAL_HOST']));
  }

  // enable custom logger using winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/');
  });
}

bootstrap();
