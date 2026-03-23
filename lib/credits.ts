import { query, transaction } from './db';
import type { PoolConnection } from 'mysql2/promise';

export {
  NEW_USER_CREDITS,
  getImageGenerationCredits,
  getVideoGenerationCredits,
} from './creditRules';

/**
 * @deprecated 扣费请使用 getImageGenerationCredits / getVideoGenerationCredits；此处仅作兼容占位
 */
export const CREDIT_COSTS = {
  AI_VIDEO: 10,
  NANO_IMAGE: 5,
};

/**
 * 查询用户积分
 * @returns 积分数量，-1 表示密钥不存在
 */
export async function getUserCredits(apiKey: string): Promise<number> {
  const rows = await query<any[]>(
    'SELECT credits FROM users WHERE api_key = ?',
    [apiKey]
  );
  if (!rows || rows.length === 0) return -1;
  return rows[0].credits;
}

/**
 * 扣减积分（原子操作，防止并发超扣）
 * @returns true 表示扣减成功，false 表示积分不足或密钥不存在
 */
export async function deductCredits(apiKey: string, cost: number): Promise<boolean> {
  const result = await query<any>(
    'UPDATE users SET credits = credits - ? WHERE api_key = ? AND credits >= ?',
    [cost, apiKey, cost]
  );
  return result.affectedRows > 0;
}

/**
 * 验证密钥并检查积分是否足够
 * @returns { valid: boolean, credits: number, enough: boolean }
 */
export async function checkCredits(apiKey: string, cost: number): Promise<{
  valid: boolean;
  credits: number;
  enough: boolean;
}> {
  const credits = await getUserCredits(apiKey);
  if (credits === -1) return { valid: false, credits: 0, enough: false };
  return { valid: true, credits, enough: credits >= cost };
}

/**
 * 任务积分流水表（用于失败返还且保证只返还一次）
 */
async function ensureTaskCreditLogTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS task_credit_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      task_id VARCHAR(200) NOT NULL,
      api_key VARCHAR(64) NOT NULL,
      task_type VARCHAR(32) NOT NULL,
      cost INT NOT NULL,
      deducted TINYINT(1) NOT NULL DEFAULT 0,
      refunded TINYINT(1) NOT NULL DEFAULT 0,
      refund_reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_task_api (task_id, api_key),
      INDEX idx_api_key (api_key),
      INDEX idx_task_id (task_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * 原子扣费并记录任务流水（事务内完成，任一失败则回滚）
 * @returns true 表示扣减+记录成功
 */
export async function deductAndRecordTaskCredits(params: {
  apiKey: string;
  taskId: string;
  taskType: 'ai_video' | 'nano_image';
  cost: number;
}): Promise<boolean> {
  await ensureTaskCreditLogTable();

  try {
    await transaction(async (conn: PoolConnection) => {
      const [deductResult] = await conn.execute<any>(
        'UPDATE users SET credits = credits - ? WHERE api_key = ? AND credits >= ?',
        [params.cost, params.apiKey, params.cost]
      );
      if (!deductResult?.affectedRows || deductResult.affectedRows === 0) {
        throw new Error('积分不足或密钥不存在');
      }
      await conn.execute(
        `INSERT INTO task_credit_logs (task_id, api_key, task_type, cost, deducted, refunded)
         VALUES (?, ?, ?, ?, 1, 0)
         ON DUPLICATE KEY UPDATE
           task_type = VALUES(task_type),
           cost = VALUES(cost),
           deducted = VALUES(deducted)`,
        [params.taskId, params.apiKey, params.taskType, params.cost]
      );
    });
    return true;
  } catch (err) {
    console.error('deductAndRecordTaskCredits 失败:', err);
    return false;
  }
}

/**
 * 记录任务扣分（幂等）- 保留供兼容，新逻辑请使用 deductAndRecordTaskCredits
 */
export async function recordTaskDebit(params: {
  apiKey: string;
  taskId: string;
  taskType: 'ai_video' | 'nano_image';
  cost: number;
}): Promise<void> {
  await ensureTaskCreditLogTable();
  await query(
    `INSERT INTO task_credit_logs (task_id, api_key, task_type, cost, deducted, refunded)
     VALUES (?, ?, ?, ?, 1, 0)
     ON DUPLICATE KEY UPDATE
       task_type = VALUES(task_type),
       cost = VALUES(cost),
       deducted = VALUES(deducted)`,
    [params.taskId, params.apiKey, params.taskType, params.cost]
  );
}

/**
 * 任务失败返还积分（只返还一次，事务保证原子性）
 * @returns true 表示本次确实执行了返还
 */
export async function refundTaskCredits(params: {
  apiKey: string;
  taskId: string;
  reason?: string;
}): Promise<boolean> {
  await ensureTaskCreditLogTable();

  const rows = await query<any[]>(
    `SELECT id, cost, deducted, refunded
     FROM task_credit_logs
     WHERE task_id = ? AND api_key = ?
     LIMIT 1`,
    [params.taskId, params.apiKey]
  );

  if (!rows || rows.length === 0) return false;
  const row = rows[0];
  if (!row.deducted || row.refunded) return false;

  try {
    const didRefund = await transaction(async (conn: PoolConnection) => {
      const [markResult] = await conn.execute<any>(
        `UPDATE task_credit_logs
         SET refunded = 1, refund_reason = ?
         WHERE id = ? AND refunded = 0`,
        [params.reason || 'task_failed', row.id]
      );
      if (!markResult?.affectedRows || markResult.affectedRows === 0) return false;

      await conn.execute(
        `UPDATE users SET credits = credits + ? WHERE api_key = ?`,
        [row.cost, params.apiKey]
      );
      return true;
    });
    return didRefund === true;
  } catch (err) {
    console.error('refundTaskCredits 失败:', err);
    return false;
  }
}
