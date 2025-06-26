/**
 * PostgreSQL Database Connection Utility
 * Replaces Cloudflare D1 for self-hosted deployment
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// Global connection pool
let pool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getDatabase(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Parse connection string or use individual components
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {
      max: 20, // Maximum number of connections
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
    };

    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      // Use connection string
      config.connectionString = databaseUrl;
      // Explicitly disable SSL for local development
      config.ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    } else {
      // Fallback to individual connection parameters
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT || '5432');
      config.database = process.env.DB_NAME || 'backlink_tracker';
      config.user = process.env.DB_USER || 'backlink_user';
      config.password = process.env.DB_PASSWORD || 'change_this_password';
      config.ssl = false; // Disable SSL for local development
    }

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });

    // Log successful connection
    pool.connect()
      .then((client: PoolClient) => {
        console.log('PostgreSQL database connected successfully');
        client.release();
      })
      .catch((err: Error) => {
        console.error('Failed to connect to PostgreSQL database:', err);
      });
  }

  return pool;
}

/**
 * Execute a single query
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const db = getDatabase();
  const start = Date.now();
  
  try {
    const result = await db.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`Slow query detected (${duration}ms):`, text);
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the database connection pool
 * (mainly for testing or graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
} 