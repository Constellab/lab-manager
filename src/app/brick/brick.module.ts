import { Module } from '@nestjs/common';
import { BrickService } from './brick.service';
import { BrickController } from './brick.controller';

@Module({
  providers: [BrickService],
  controllers: [BrickController]
})
export class BrickModule {}
