// Next.js API route to refresh TikTok access token
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  code?: number
  message?: string
  data?: any
  error?: string
  error_code?: number
  details?: any
  request_id?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    // 统一返回 200：让前端通过 code/message 处理
    res.status(200).json({ code: -1, error: 'Method not allowed', message: 'Method not allowed' })
    return
  }

  // 获取请求体（兼容：对象 / 字符串 / 空）
  let refresh_token: string | undefined
  try {
    const body: any = req.body
    if (typeof body === 'string' && body.trim()) {
      const parsed = JSON.parse(body)
      refresh_token = parsed?.refresh_token ?? parsed?.refreshToken
    } else if (body && typeof body === 'object') {
      refresh_token = body?.refresh_token ?? body?.refreshToken
    }
  } catch {
    // ignore: fallthrough to validation error
  }

  // 验证必需参数
  if (!refresh_token) {
    res.status(200).json({
      code: -1,
      error: 'Missing required parameter: refresh_token',
      message: 'Missing required parameter: refresh_token',
    })
    return
  }

  try {
    // 从环境变量获取TikTok应用配置
    const clientId = process.env.TIKTOK_CLIENT_ID || '7519030880531447825'
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET || ''

    if (!clientSecret) {
      // 统一返回 200：让前端通过 code/message 处理
      res.status(200).json({
        code: -1,
        error: 'TIKTOK_CLIENT_SECRET is not configured. Please set it in environment variables.',
        message: 'TIKTOK_CLIENT_SECRET is not configured. Please set it in environment variables.',
      })
      return
    }

    // 构建请求体
    const requestBody = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: String(refresh_token).trim()
    }

    console.log(`Refreshing TikTok token with client_id: ${clientId}`)

    // 调用TikTok刷新Token接口
    const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    // 解析响应数据
    const responseText = await response.text()
    let data: any = null
    try {
      data = responseText ? JSON.parse(responseText) : null
    } catch {
      data = null
    }

    // 检查响应状态和业务错误码
    if (!response.ok || !data || typeof data !== 'object' || data.code !== 0) {
      const structured = data && typeof data === 'object' ? data : null
      const errorMessage =
        structured?.message ||
        structured?.error_description ||
        structured?.error ||
        `Request failed: ${response.status} ${response.statusText}`
      console.error(`Token refresh failed:`, errorMessage)

      // 统一返回 200：让前端通过 code/message 处理（避免 fetch 直接抛 HTTP 500）
      if (structured) {
        res.status(200).json(structured)
        return
      }
      res.status(200).json({
        code: -1,
        error: errorMessage,
        message: responseText || errorMessage,
        error_code: structured?.error_code,
      })
      return
    }

    console.log(`✅ Token refreshed successfully for open_id: ${data.data?.open_id || 'unknown'}`)

    // 返回成功数据
    res.status(200).json(data)
  } catch (error: any) {
    console.error('Token refresh error:', error)
    res.status(200).json({
      code: -1,
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      details: error?.cause || undefined,
    })
  }
}


