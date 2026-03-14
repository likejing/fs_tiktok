import mysql from 'mysql2/promise';

/**
 * MySQL 数据库连接池
 */
let pool: mysql.Pool | null = null;

/**
 * 获取数据库连接池
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    // 检查是否启用数据库备份
    const enableBackup = process.env.ENABLE_DB_BACKUP !== 'false';

    if (!enableBackup) {
      throw new Error('Database backup is disabled');
    }

    // 创建连接池
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      database: process.env.MYSQL_DATABASE || 'fs_tiktok_backup',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    console.log('MySQL connection pool created');
  }

  return pool;
}

/**
 * 执行 SQL 查询
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 执行事务
 */
export async function transaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 关闭数据库连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL connection pool closed');
  }
}

/**
 * 检查数据库连接是否可用
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * 是否启用数据库备份
 */
export function isBackupEnabled(): boolean {
  return process.env.ENABLE_DB_BACKUP !== 'false';
}
