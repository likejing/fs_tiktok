// Next.js API route to proxy TikTok video list request
import type { NextApiRequest, NextApiResponse } from 'next'
import { syncVideo, logOperation } from '../../lib/dbSync'

type Data = {
  code?: number
  message?: string
  data?: any
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // 获取查询参数
  const { access_token, business_id, fields, cursor, max_count, filters } = req.query

  // 验证必需参数
  if (!access_token || !business_id) {
    res.status(400).json({ 
      code: -1,
      error: 'Missing required parameters: access_token and business_id are both required' 
    })
    return
  }

  try {
    // 构建请求URL
    let apiUrl = `https://business-api.tiktok.com/open_api/v1.3/business/video/list/?business_id=${encodeURIComponent(business_id as string)}`
    
    // 添加可选参数
    if (fields) {
      // fields 参数应该是一个 JSON 数组字符串，直接传递
      apiUrl += `&fields=${encodeURIComponent(fields as string)}`
    }
    if (cursor) {
      apiUrl += `&cursor=${encodeURIComponent(cursor as string)}`
    }
    if (max_count) {
      apiUrl += `&max_count=${encodeURIComponent(max_count as string)}`
    }
    if (filters) {
      // filters 参数为 JSON 对象字符串，例如：{"video_ids":["xxx"]}
      apiUrl += `&filters=${encodeURIComponent(filters as string)}`
    }
    
    console.log(`Requesting TikTok video list for business_id: ${business_id}`)

    // 在服务端发起请求
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Access-Token': access_token as string,
      },
    })

    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`TikTok API error: ${response.status} ${response.statusText}`, errorText)
      res.status(response.status).json({
        code: -1,
        error: `Request failed: ${response.status} ${response.statusText}`,
        message: errorText
      })
      return
    }

    // 解析响应数据
    const data = await response.json()
    
    // 检查业务错误码
    if (data.code !== 0) {
      const errorMessage = data.message || data.error_description || data.error || 'Unknown error'
      console.error(`TikTok API business error:`, errorMessage)
      res.status(200).json({
        code: data.code || -1,
        error: errorMessage,
        message: errorMessage
      })
      return
    }

    // ✅ 备份视频列表到 MySQL（异步，不影响主流程）
    try {
      const videos: any[] = Array.isArray(data?.data?.videos)
        ? data.data.videos
        : Array.isArray(data?.data?.list)
          ? data.data.list
          : []

      if (videos.length > 0) {
        const businessIdStr = String(business_id)

        await Promise.allSettled(
          videos.map((v: any) => {
            const itemId = v?.item_id ?? v?.video_id ?? v?.id
            if (!itemId) return Promise.resolve()

            const videoIdStr = String(itemId)
            const recordId = `tiktok_${videoIdStr}`

            return syncVideo({
              recordId,
              videoId: videoIdStr,
              openId: businessIdStr,
              title: v?.title ?? v?.caption ?? null,
              caption: v?.caption ?? null,
              shareUrl: v?.share_url ?? null,
              embedLink: v?.embed_url ?? v?.embed_link ?? null,
              coverImageUrl: v?.thumbnail_url ?? v?.cover_image_url ?? null,
              duration: typeof v?.video_duration === 'number' ? v.video_duration : (v?.duration ?? null),
              viewCount: v?.video_views ?? v?.view_count ?? null,
              likeCount: v?.likes ?? v?.like_count ?? null,
              commentCount: v?.comments ?? v?.comment_count ?? null,
              shareCount: v?.shares ?? v?.share_count ?? null,
              createTime: v?.create_time ?? null,
            })
          })
        )

        logOperation({
          tableName: 'videos',
          recordId: businessIdStr,
          operation: 'update',
          dataAfter: { business_id: businessIdStr, count: videos.length },
          apiEndpoint: '/api/getTkVideoList',
          userAgent: req.headers['user-agent'],
          ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
        }).catch(() => {})
      }
    } catch (e) {
      console.warn('备份视频列表到数据库失败（已忽略，不影响主流程）:', e)
    }
    
    // 返回成功数据
    res.status(200).json(data)
  } catch (error: any) {
    console.error('Proxy request error:', error)
    res.status(500).json({
      code: -1,
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    })
  }
}


