import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';
import { NEW_USER_CREDITS } from '../../lib/creditRules';
import crypto from 'crypto';

/**
 * 根据飞书 userId 或 URL 初始化用户
 * - 新用户：生成唯一密钥，赠送积分（见 lib/creditRules NEW_USER_CREDITS）
 * - 老用户：直接返回已有密钥和积分
 *
 * 支持的 remark 格式：
 * - lark:{userId} - 飞书用户
 * - url:{url} - URL 生成的用户
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { user_id, base_user_id, tenant_key, url } = req.body;

  // 优先使用飞书身份（tenant_key + base_user_id）
  const larkIdentity =
    base_user_id && tenant_key
      ? `${tenant_key}:${base_user_id}`
      : base_user_id || user_id;

  let remark = larkIdentity ? `lark:${larkIdentity}` : null;
  let identifier = larkIdentity || url;

  if (!identifier) {
    res.status(400).json({ code: -1, error: '缺少 user_id 或 url' });
    return;
  }

  // 如果没有飞书用户ID，使用URL
  if (!remark && url) {
    remark = `url:${url}`;
  }

  try {
    // 查询是否已存在
    const rows = await query<any[]>(
      'SELECT api_key, credits FROM users WHERE remark = ?',
      [remark]
    );

    if (rows && rows.length > 0) {
      // 老用户，直接返回
      res.status(200).json({ code: 0, data: { api_key: rows[0].api_key, credits: rows[0].credits } });
      return;
    }

    // 新用户：生成唯一密钥
    const apiKey = crypto.randomBytes(16).toString('hex');

    await query(
      'INSERT INTO users (api_key, credits, remark) VALUES (?, ?, ?)',
      [apiKey, NEW_USER_CREDITS, remark]
    );

    res.status(200).json({ code: 0, data: { api_key: apiKey, credits: NEW_USER_CREDITS } });
  } catch (error: any) {
    console.error('initUser 失败:', error);
    res.status(500).json({ code: -1, error: '初始化用户失败' });
  }
}
