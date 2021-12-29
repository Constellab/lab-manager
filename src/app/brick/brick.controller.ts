import {Controller, Get} from '@nestjs/common';
import {Brick} from './brick.class';
import {BrickService} from './brick.service';

@Controller('bricks')
export class BrickController {

  constructor(private brickService: BrickService) {
  }

  @Get()
  getBricks(): Promise<Brick[]> {
    return this.brickService.getBricks();
  }
}
