import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import config from '../../config.js';

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(config.database.url);
}

export function getPool(): Pool {
  if (!config.database.url) {
    throw new Error('DATABASE_URL 未配置，持久化服务不可用');
  }
  pool ??= new Pool({
    connectionString: config.database.url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(): Promise<'connected' | 'not_configured' | 'unavailable'> {
  if (!isDatabaseConfigured()) return 'not_configured';
  try {
    await query('SELECT 1');
    return 'connected';
  } catch {
    return 'unavailable';
  }
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
