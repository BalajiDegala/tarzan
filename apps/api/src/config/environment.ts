const MINIMUM_JWT_SECRET_LENGTH = 32;

function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${key} is required`);
  }

  return value;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  requiredString(config, 'DATABASE_URL');
  const jwtSecret = requiredString(config, 'JWT_SECRET');

  if (jwtSecret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters`,
    );
  }

  const cookieSecure = config.COOKIE_SECURE ?? 'false';

  if (cookieSecure !== 'true' && cookieSecure !== 'false') {
    throw new Error('COOKIE_SECURE must be true or false');
  }

  return {
    ...config,
    COOKIE_SECURE: cookieSecure === 'true',
  };
}
