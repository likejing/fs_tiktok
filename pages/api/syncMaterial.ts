import type { NextApiRequest, NextApiResponse } from 'next'
import { syncMaterial, logOperation } from '../../lib/dbSync'

type Data =
  | { code: 0; message: string }
  | { code: -1; error: string; message?: string; details?: any }

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.status(200).json({ code: -1, error: 'Method not allowed', message: 'Method not allowed' })
    return
  }

  // 兼容：对象 / 字符串 body
  let body: any = req.body
  try {
    if (typeof body === 'string' && body.trim()) body = JSON.parse(body)
  } catch {
    body = req.body
  }

  const recordId = body?.recordId ?? body?.record_id
  if (!recordId) {
    res.status(200).json({
      code: -1,
      error: 'Missing required parameter: recordId',
      message: 'Missing required parameter: recordId',
    })
    return
  }

  try {
    await syncMaterial({
      recordId: String(recordId),
      caption: body?.caption ?? null,
      videoUrl: body?.videoUrl ?? body?.video_url ?? null,
      customThumbnailUrl: body?.customThumbnailUrl ?? body?.custom_thumbnail_url ?? null,
      publishStatus: body?.publishStatus ?? body?.publish_status ?? null,
      publishTime: body?.publishTime ?? body?.publish_time ?? null,
      publishAccount: body?.publishAccount ?? body?.publish_account ?? null,
      shareId: body?.shareId ?? body?.share_id ?? null,
      postIds: body?.postIds ?? body?.post_ids ?? null,
      tiktokVideoUrl: body?.tiktokVideoUrl ?? body?.tiktok_video_url ?? null,
      isBrandOrganic: body?.isBrandOrganic ?? body?.is_brand_organic ?? null,
      isBrandedContent: body?.isBrandedContent ?? body?.is_branded_content ?? null,
      isAiGenerated: body?.isAiGenerated ?? body?.is_ai_generated ?? null,
    })

    // 记录日志（异步）
    logOperation({
      tableName: 'materials',
      recordId: String(recordId),
      operation: 'update',
      dataAfter: {
        recordId: String(recordId),
        publishStatus: body?.publishStatus ?? body?.publish_status,
        publishAccount: body?.publishAccount ?? body?.publish_account,
        publishTime: body?.publishTime ?? body?.publish_time,
        shareId: body?.shareId ?? body?.share_id,
        postIds: body?.postIds ?? body?.post_ids,
        tiktokVideoUrl: body?.tiktokVideoUrl ?? body?.tiktok_video_url,
      },
      apiEndpoint: '/api/syncMaterial',
      userAgent: req.headers['user-agent'],
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    }).catch(() => {})

    res.status(200).json({ code: 0, message: 'ok' })
  } catch (error: any) {
    res.status(200).json({
      code: -1,
      error: 'Sync material failed',
      message: error?.message || 'Unknown error',
    })
  }
}

