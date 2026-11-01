export function assertDedicatedTestDatabase(): void {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must point to a dedicated database ending in _test.');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1).split('/')[0]);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive integration tests against database "${databaseName}". Use a dedicated database ending in _test.`,
    );
  }
}
