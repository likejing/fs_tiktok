import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

/**
 * 充值积分API
 * 根据api_key为用户增加积分
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { api_key, amount } = req.body;

  if (!api_key) {
    res.status(400).json({ code: -1, error: '请输入密钥' });
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
      await query(
        'INSERT INTO users (api_key, credits, remark) VALUES (?, ?, ?)',
        [api_key, amount, 'recharged']
      );
      res.status(200).json({ code: 0, data: { credits: amount } });
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

    res.status(200).json({ code: 0, data: { credits: updatedRows[0].credits } });
  } catch (error: any) {
    console.error('充值失败:', error);
    res.status(500).json({ code: -1, error: '充值失败，请稍后重试' });
  }
}