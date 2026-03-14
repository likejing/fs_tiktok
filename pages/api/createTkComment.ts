import type { NextApiRequest, NextApiResponse } from 'next'
import { syncComment, logOperation } from '../../lib/dbSync'

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

    console.log(`创建 TikTok 评论: video_id=${video_id}, business_id=${business_id}`)
    console.log(`请求参数:`, {
      business_id,
      video_id,
      text: String(text).substring(0, 150),
      access_token_length: String(access_token).length
    })

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

    console.log(`TikTok API 响应:`, {
      status: response.status,
      ok: response.ok,
      data
    })

    if (!response.ok) {
      console.error('TikTok API 错误:', data)
      res.status(response.status).json(data)
      return
    }

    // 同步评论数据到 MySQL（异步，不阻塞主流程）
    if (data.code === 0 && data.data && data.data.comment_id) {
      syncComment({
        commentId: data.data.comment_id,
        videoId: video_id,
        openId: business_id,
        text: String(text).substring(0, 150),
        createTime: data.data.create_time ? parseInt(data.data.create_time) : Date.now() / 1000,
        status: 'active',
      }).catch(err => console.error('同步评论数据失败:', err));

      // 记录操作日志
      logOperation({
        tableName: 'comments',
        recordId: data.data.comment_id,
        operation: 'create',
        dataAfter: {
          commentId: data.data.comment_id,
          videoId: video_id,
          text: String(text).substring(0, 150),
        },
        apiEndpoint: '/api/createTkComment',
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      }).catch(err => console.error('记录操作日志失败:', err));
    }

    res.status(200).json(data)
  } catch (error: any) {
    console.error('创建评论失败:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
