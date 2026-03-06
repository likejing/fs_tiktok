// Next.js API route to upload file directly to Aliyun OSS (支持 Base64 或 URL)
import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

type Data = {
  code?: number
  message?: string
  data?: {
    url: string
    key: string
  }
  error?: string
}

// 生成OSS签名（适用于PUT请求）
function generateOSSSignature(
  method: string,
  contentType: string,
  date: string,
  bucket: string,
  objectKey: string,
  accessKeySecret: string
): string {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n/${bucket}/${objectKey}`
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(stringToSign)
    .digest('base64')
  return signature
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // 支持大文件上传
    },
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { fileUrl, fileData, fileName, folder, contentType: customContentType } = req.body

  // 验证必需参数
  if (!fileUrl && !fileData) {
    res.status(400).json({
      code: -1,
      error: 'Missing required parameter: fileUrl or fileData'
    })
    return
  }

  try {
    // 从环境变量获取OSS配置
    const ossConfig = {
      region: process.env.OSS_REGION || '',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET_NAME || process.env.OSS_BUCKET || '',
      endpoint: process.env.OSS_ENDPOINT || '',
      customDomain: process.env.OSS_CUSTOM_DOMAIN || '',
    }

    // 验证配置
    if (!ossConfig.region || !ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      res.status(500).json({
        code: -1,
        error: 'OSS configuration is missing'
      })
      return
    }

    let buffer: Buffer
    let contentType: string

    // 1. 获取文件数据
    if (fileData) {
      // 从 Base64 数据获取
      console.log('Processing Base64 file data...')
      buffer = Buffer.from(fileData, 'base64')
      contentType = customContentType || 'video/mp4'
    } else {
      // 从 URL 下载
      console.log(`Downloading file from: ${fileUrl}`)
      const fileResponse = await fetch(fileUrl)
      if (!fileResponse.ok) {
        res.status(400).json({
          code: -1,
          error: `Failed to download file: ${fileResponse.status}`
        })
        return
      }

      const fileBuffer = await fileResponse.arrayBuffer()
      buffer = Buffer.from(fileBuffer)
      contentType = fileResponse.headers.get('content-type') || 'application/octet-stream'
    }

    console.log(`File ready: ${buffer.length} bytes, type: ${contentType}`)

    // 2. 生成OSS对象键
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExtension = fileName ? fileName.split('.').pop() : 'mp4'
    const objectKey = folder
      ? `${folder}/${timestamp}_${randomStr}.${fileExtension}`
      : `tiktok-videos/${timestamp}_${randomStr}.${fileExtension}`

    // 3. 构建OSS上传URL
    let ossHost: string
    if (ossConfig.endpoint) {
      if (ossConfig.endpoint.startsWith('oss-')) {
        ossHost = `${ossConfig.bucket}.${ossConfig.endpoint}`
      } else {
        ossHost = `${ossConfig.bucket}.${ossConfig.endpoint}`
      }
    } else {
      const regionPart = ossConfig.region.startsWith('oss-')
        ? ossConfig.region
        : `oss-${ossConfig.region}`
      ossHost = `${ossConfig.bucket}.${regionPart}.aliyuncs.com`
    }
    const ossUrl = `https://${ossHost}/${objectKey}`

    // 4. 生成签名并上传
    const date = new Date().toUTCString()
    const signature = generateOSSSignature('PUT', contentType, date, ossConfig.bucket, objectKey, ossConfig.accessKeySecret)
    const authorization = `OSS ${ossConfig.accessKeyId}:${signature}`

    console.log(`Uploading to OSS: ${ossUrl}`)

    const uploadResponse = await fetch(ossUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Date': date,
        'Authorization': authorization,
      },
      body: new Uint8Array(buffer)
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error(`OSS upload failed: ${uploadResponse.status}`, errorText)
      res.status(500).json({
        code: -1,
        error: `Failed to upload to OSS: ${uploadResponse.status}`,
        message: errorText
      })
      return
    }

    console.log(`✅ File uploaded successfully to OSS: ${ossUrl}`)

    // 如果配置了自定义域名，替换URL
    let finalUrl = ossUrl
    if (ossConfig.customDomain) {
      const ossBaseUrl = `https://${ossHost}/`
      const customDomain = ossConfig.customDomain.startsWith('http')
        ? ossConfig.customDomain
        : `https://${ossConfig.customDomain}`
      finalUrl = ossUrl.replace(ossBaseUrl, `${customDomain}/`)
      console.log(`✅ URL已替换为自定义域名: ${finalUrl}`)
    }

    res.status(200).json({
      code: 0,
      message: 'Upload successful',
      data: {
        url: finalUrl,
        key: objectKey,
        ...(ossConfig.customDomain && { originalUrl: ossUrl })
      }
    })
  } catch (error: any) {
    console.error('OSS upload error:', error)
    res.status(500).json({
      code: -1,
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    })
  }
}
