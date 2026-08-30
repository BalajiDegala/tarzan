import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppModule } from './app.module';

describe('AppModule', () => {
  it('resolves the complete application dependency graph', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppModule)).toBeInstanceOf(AppModule);
    await module.close();
  });
});
