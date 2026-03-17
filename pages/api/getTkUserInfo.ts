// Next.js API route to proxy TikTok user info request
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  code?: number
  message?: string
  data?: any
  error?: string
  details?: any
  request_id?: string
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
  const { access_token, open_id } = req.query

  // 验证必需参数
  if (!access_token || !open_id) {
    res.status(400).json({ 
      code: -1,
      error: 'Missing required parameters: access_token and open_id are both required' 
    })
    return
  }

  try {
    // 构建请求URL
    const apiUrl = `https://ltexpress.huokechuangxin.cn/getTkUserInfo?access_token=${encodeURIComponent(access_token as string)}&open_id=${encodeURIComponent(open_id as string)}`
    
    // 在服务端发起请求
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    const rawText = await response.text()
    let json: any = null
    try {
      json = rawText ? JSON.parse(rawText) : null
    } catch {
      json = null
    }

    // 统一返回 200：上游即使是 401/500（业务错误），也让前端按 code/message 处理
    if (!response.ok) {
      // 上游如果已经是结构化错误，直接透传；否则包装成通用错误
      if (json && typeof json === 'object') {
        res.status(200).json(json)
        return
      }
      res.status(200).json({
        code: -1,
        error: `Request failed: ${response.status} ${response.statusText}`,
        message: rawText || 'Unknown error'
      })
      return
    }

    // 上游返回 200，但也可能包含业务错误 code
    if (json && typeof json === 'object') {
      res.status(200).json(json)
      return
    }

    // 极少数情况：返回不是 JSON
    res.status(200).json({
      code: -1,
      error: 'Invalid upstream response',
      message: rawText || 'Empty response'
    })
  } catch (error: any) {
    console.error('Proxy request error:', error)
    res.status(200).json({
      code: -1,
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    })
  }
}




