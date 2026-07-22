import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { getLocalCors, getPrivateCloudCors } from './app/core/utils/core.config';
import { EnvironmentProfile } from './app/core/models/config.class';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const portEnv = process.env['PORT'];
  if (!portEnv) {
    throw new Error('PORT environment variable is not set');
  }
  const port = parseInt(portEnv);

  // enable cors
  const env: EnvironmentProfile = process.env['ENVIRONMENT_PROFILE'] as EnvironmentProfile;
  if (env === 'dev' || env === 'desktop' || env === 'test') {
    app.enableCors(getLocalCors());
  } else if (env === 'private-cloud') {
    const virtualHost = process.env['VIRTUAL_HOST'];
    if (!virtualHost) {
      throw new Error('VIRTUAL_HOST environment variable is not set');
    }
    // The standalone front lives on a different subdomain than the API.
    app.enableCors(getPrivateCloudCors(virtualHost));
  }

  // enable custom logger using winston
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/');
  });
}

bootstrap();
