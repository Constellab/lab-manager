import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  it('should be defined', () => {
    expect(new ApiKeyGuard({} as any, {} as any, {} as any)).toBeDefined();
  });
});
