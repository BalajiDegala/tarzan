import { describe, expect, it } from 'vitest';

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  it('reports API health', () => {
    const controller = new AppController(new AppService());

    expect(controller.getHealth()).toEqual({
      name: 'Tarzan',
      status: 'ok',
      version: '0.1.0',
    });
  });
});
