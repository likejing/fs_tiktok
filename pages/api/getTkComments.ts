import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * 获取 TikTok 视频评论列表
 * API 文档: https://business-api.tiktok.com/portal/docs
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { access_token, business_id, video_id, cursor, max_count, status, sort_field, sort_order, include_replies } = req.query

  if (!access_token || !business_id || !video_id) {
    res.status(400).json({ error: 'Missing required parameters: access_token, business_id, video_id' })
    return
  }

  try {
    // 构建请求 URL
    let url = `https://business-api.tiktok.com/open_api/v1.3/business/comment/list/?business_id=${business_id}&video_id=${video_id}`
    
    if (cursor) url += `&cursor=${cursor}`
    if (max_count) url += `&max_count=${max_count}`
    if (status) url += `&status=${status}`
    if (sort_field) url += `&sort_field=${sort_field}`
    if (sort_order) url += `&sort_order=${sort_order}`
    if (include_replies) url += `&include_replies=${include_replies}`

    console.log(`请求 TikTok 评论列表: video_id=${video_id}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Access-Token': String(access_token),
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('TikTok API 错误:', data)
      res.status(response.status).json(data)
      return
    }

    res.status(200).json(data)
  } catch (error: any) {
    console.error('获取评论列表失败:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
