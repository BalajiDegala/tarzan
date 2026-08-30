export const APP_NAME = 'Tarzan';
export const APP_VERSION = '0.1.0';
export const DEFAULT_API_PORT = 3000;

export function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}
