import { APP_NAME, APP_VERSION } from '@tarzan/config';
import type { ServiceHealth } from '@tarzan/types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): ServiceHealth {
    return {
      name: APP_NAME,
      status: 'ok',
      version: APP_VERSION,
    };
  }
}
