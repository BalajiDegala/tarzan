import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment';

const validConfig = {
  DATABASE_URL: 'postgresql://tarzan:password@localhost:5432/tarzan',
  JWT_SECRET: 'a-secure-development-secret-with-32-characters',
};

describe('validateEnvironment', () => {
  it('requires a database URL', () => {
    expect(() =>
      validateEnvironment({ JWT_SECRET: validConfig.JWT_SECRET }),
    ).toThrow('DATABASE_URL is required');
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, JWT_SECRET: 'too-short' }),
    ).toThrow('JWT_SECRET must be at least 32 characters');
  });

  it('rejects an invalid secure-cookie setting', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, COOKIE_SECURE: 'yes' }),
    ).toThrow('COOKIE_SECURE must be true or false');
  });

  it('normalizes the secure-cookie setting to a boolean', () => {
    expect(
      validateEnvironment({ ...validConfig, COOKIE_SECURE: 'true' })
        .COOKIE_SECURE,
    ).toBe(true);
    expect(validateEnvironment(validConfig).COOKIE_SECURE).toBe(false);
  });
});
