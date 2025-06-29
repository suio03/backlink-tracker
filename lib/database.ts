/**
 * PostgreSQL Database Connection Utility
 * Optimized for Supabase PostgreSQL
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

    // Configuration optimized for Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {
      max: 10, // Reduced for Supabase free tier
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Increased timeout for cloud database
      statement_timeout: 60000, // 60 second statement timeout
      query_timeout: 60000, // 60 second query timeout
    };

    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      // Use connection string
      config.connectionString = databaseUrl;
      
      // SSL configuration for Supabase
      if (process.env.NODE_ENV === 'production' || databaseUrl.includes('supabase.co')) {
        config.ssl = { rejectUnauthorized: false };
      } else {
        config.ssl = false; // Local development
      }
    } else {
      // Fallback to individual connection parameters
      config.host = process.env.DB_HOST || 'localhost';
      config.port = parseInt(process.env.DB_PORT || '5432');
      config.database = process.env.DB_NAME || 'postgres';
      config.user = process.env.DB_USER || 'postgres';
      config.password = process.env.DB_PASSWORD;
      config.ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    }

    pool = new Pool(config);

    // Handle pool errors
    pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
      // Don't exit the process, just log the error
    });

    // Handle connection events
    pool.on('connect', () => {
      console.log('New client connected to database');
    });

    pool.on('remove', () => {
      console.log('Client removed from pool');
    });

    // Test initial connection
    pool.connect()
      .then((client: PoolClient) => {
        console.log('✅ PostgreSQL database connected successfully');
        client.release();
      })
      .catch((err: Error) => {
        console.error('❌ Failed to connect to PostgreSQL database:', err.message);
      });
  }

  return pool;
}

/**
 * Execute a single query
 */
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const db = getDatabase();
  try {
    const result = await db.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error);
    console.error('🔍 Query:', text);
    console.error('🔍 Params:', params);
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
    console.error('❌ Transaction rolled back:', error);
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
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection test successful');
    console.log('📅 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].pg_version.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

/**
 * Check if connected to Supabase
 */
export function isSupabase(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl ? databaseUrl.includes('supabase.co') : false;
}

/**
 * Get database info
 */
export async function getDatabaseInfo(): Promise<{
  isSupabase: boolean;
  host: string;
  database: string;
  ssl: boolean;
}> {
  const databaseUrl = process.env.DATABASE_URL || '';
  const isSupabaseDb = isSupabase();
  
  // Parse connection info
  let host = 'unknown';
  let database = 'unknown';
  
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      host = url.hostname;
      database = url.pathname.substring(1);
    } catch {
      console.warn('Could not parse DATABASE_URL');
    }
  }
  
  return {
    isSupabase: isSupabaseDb,
    host,
    database,
    ssl: process.env.NODE_ENV === 'production' || isSupabaseDb
  };
} 