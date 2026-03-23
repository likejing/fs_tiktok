import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';

/**
 * 内部充值接口 - 需要专属密钥验证
 * 用于管理员手动给用户充值积分
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ code: -1, error: 'Method not allowed' });
    return;
  }

  // 验证充值专属密钥
  const RECHARGE_SECRET = process.env.RECHARGE_SECRET || 'recharge_2024_secure_key';
  const providedSecret = req.headers['x-recharge-secret'] || req.body.secret;

  if (providedSecret !== RECHARGE_SECRET) {
    res.status(401).json({ code: -1, error: '密钥验证失败' });
    return;
  }

  const { api_key, amount, remark } = req.body;

  if (!api_key) {
    res.status(400).json({ code: -1, error: '请提供 api_key' });
    return;
  }

  if (!amount || amount <= 0) {
    res.status(400).json({ code: -1, error: '请输入有效的充值金额' });
    return;
  }

  try {
    // 检查用户是否存在
    const rows = await query<any[]>(
      'SELECT credits FROM users WHERE api_key = ?',
      [api_key]
    );

    if (!rows || rows.length === 0) {
      // 用户不存在，创建新用户
      const newRemark = remark || 'admin_recharge';
      await query(
        'INSERT INTO users (api_key, credits, remark) VALUES (?, ?, ?)',
        [api_key, amount, newRemark]
      );
      res.status(200).json({ code: 0, data: { credits: amount, action: 'created' } });
      return;
    }

    // 用户存在，增加积分
    await query(
      'UPDATE users SET credits = credits + ? WHERE api_key = ?',
      [amount, api_key]
    );

    // 获取最新积分
    const updatedRows = await query<any[]>(
      'SELECT credits FROM users WHERE api_key = ?',
      [api_key]
    );

    // 记录充值日志（可选）
    console.log(`[充值] api_key: ${api_key}, 金额: ${amount}, 剩余: ${updatedRows[0].credits}, 操作人: ${remark || 'admin'}`);

    res.status(200).json({ code: 0, data: { credits: updatedRows[0].credits, action: 'updated' } });
  } catch (error: any) {
    console.error('充值失败:', error);
    res.status(500).json({ code: -1, error: '充值失败，请稍后重试' });
  }
}