import type { NextApiRequest, NextApiResponse } from 'next'
import { syncAccount, logOperation } from '../../lib/dbSync'

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
  const openId = body?.openId ?? body?.open_id

  if (!recordId || !openId) {
    res.status(200).json({
      code: -1,
      error: 'Missing required parameters: recordId and openId are both required',
      message: 'Missing required parameters: recordId and openId are both required',
      details: { recordId, openId },
    })
    return
  }

  try {
    // 异步同步（但这里 await 一下保证请求返回前已入库；失败也不会影响主流程）
    await syncAccount({
      recordId: String(recordId),
      openId: String(openId),
      username: body?.username,
      displayName: body?.displayName ?? body?.display_name,
      accessToken: body?.accessToken ?? body?.access_token,
      refreshToken: body?.refreshToken ?? body?.refresh_token,
      tokenExpiresTime: body?.tokenExpiresTime ?? body?.token_expires_time,
      profileImage: body?.profileImage ?? body?.profile_image,
      followersCount: body?.followersCount ?? body?.followers_count,
      totalLikes: body?.totalLikes ?? body?.total_likes,
      videosCount: body?.videosCount ?? body?.videos_count,
      followingCount: body?.followingCount ?? body?.following_count,
    })

    // 记录操作日志（异步，不阻塞）
    logOperation({
      tableName: 'accounts',
      recordId: String(recordId),
      operation: 'update',
      dataAfter: {
        recordId: String(recordId),
        openId: String(openId),
        username: body?.username,
        displayName: body?.displayName ?? body?.display_name,
        profileImage: body?.profileImage ?? body?.profile_image,
        followersCount: body?.followersCount ?? body?.followers_count,
        totalLikes: body?.totalLikes ?? body?.total_likes,
        videosCount: body?.videosCount ?? body?.videos_count,
        followingCount: body?.followingCount ?? body?.following_count,
        // 不在日志里记录 token 明文
        hasAccessToken: Boolean(body?.accessToken ?? body?.access_token),
        hasRefreshToken: Boolean(body?.refreshToken ?? body?.refresh_token),
        tokenExpiresTime: body?.tokenExpiresTime ?? body?.token_expires_time,
      },
      apiEndpoint: '/api/syncAccount',
      userAgent: req.headers['user-agent'],
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    }).catch(() => {})

    res.status(200).json({ code: 0, message: 'ok' })
  } catch (error: any) {
    // 备份失败不应影响前端主流程，所以仍返回 200，但用 code 标记
    res.status(200).json({
      code: -1,
      error: 'Sync account failed',
      message: error?.message || 'Unknown error',
    })
  }
}

