import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = 3010
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/');
  });
}
bootstrap();
