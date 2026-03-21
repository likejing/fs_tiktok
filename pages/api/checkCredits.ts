import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCredits } from '../../lib/credits';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { api_key, cost = 0 } = req.body;

  if (!api_key) {
    res.status(400).json({ code: -1, error: '请输入密钥' });
    return;
  }

  try {
    const result = await checkCredits(api_key, cost);

    if (!result.valid) {
      res.status(200).json({ code: -1, error: '密钥无效' });
      return;
    }

    res.status(200).json({
      code: 0,
      data: {
        credits: result.credits,
        enough: result.enough,
      }
    });
  } catch (error: any) {
    console.error('查询积分失败:', error);
    res.status(500).json({ code: -1, error: '查询积分失败，请稍后重试' });
  }
}
