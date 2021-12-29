import { Test, TestingModule } from '@nestjs/testing';
import { BrickController } from './brick.controller';

describe('BrickController', () => {
  let controller: BrickController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BrickController],
    }).compile();

    controller = module.get<BrickController>(BrickController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
