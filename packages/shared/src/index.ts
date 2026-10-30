export const sharedConfig = {
  appName: 'saas-pos',
  version: '0.1.0',
  environment: process.env.NODE_ENV ?? 'development',
};

export function buildApiBaseUrl() {
  return process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
}
