import { query, isBackupEnabled } from './db';

/**
 * 积分消耗配置
 */
export const CREDIT_COSTS = {
  AI_VIDEO: 10,    // AI 视频生成消耗积分
  NANO_IMAGE: 2,   // Nano 图像生成消耗积分
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
