import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * 为 TikTok 视频创建评论
 * API 文档: https://business-api.tiktok.com/portal/docs
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { access_token, business_id, video_id, text } = req.body

  if (!access_token || !business_id || !video_id || !text) {
    res.status(400).json({ error: 'Missing required parameters: access_token, business_id, video_id, text' })
    return
  }

  try {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/business/comment/create/'

    console.log(`创建 TikTok 评论: video_id=${video_id}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Access-Token': String(access_token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_id,
        video_id,
        text: String(text).substring(0, 150), // 最大150字符
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('TikTok API 错误:', data)
      res.status(response.status).json(data)
      return
    }

    res.status(200).json(data)
  } catch (error: any) {
    console.error('创建评论失败:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
