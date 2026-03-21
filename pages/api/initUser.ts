import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import crypto from 'crypto';

/**
 * 根据飞书 userId 初始化用户
 * - 新用户：生成唯一密钥，赠送 10 积分
 * - 老用户：直接返回已有密钥和积分
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { user_id } = req.body;
  if (!user_id) {
    res.status(400).json({ code: -1, error: '缺少 user_id' });
    return;
  }

  try {
    // 查询是否已存在
    const rows = await query<any[]>(
      'SELECT api_key, credits FROM users WHERE remark = ?',
      [`lark:${user_id}`]
    );

    if (rows && rows.length > 0) {
      // 老用户，直接返回
      res.status(200).json({ code: 0, data: { api_key: rows[0].api_key, credits: rows[0].credits } });
      return;
    }

    // 新用户：生成唯一密钥
    const apiKey = crypto.randomBytes(16).toString('hex');

    await query(
      'INSERT INTO users (api_key, credits, remark) VALUES (?, 10, ?)',
      [apiKey, `lark:${user_id}`]
    );

    res.status(200).json({ code: 0, data: { api_key: apiKey, credits: 10 } });
  } catch (error: any) {
    console.error('initUser 失败:', error);
    res.status(500).json({ code: -1, error: '初始化用户失败' });
  }
}
