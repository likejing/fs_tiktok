import type { NextApiRequest, NextApiResponse } from 'next';

// API 配置
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '50mb', // 支持大图片 base64
    },
  },
};

type ApiResponse = {
  code?: number;
  data?: any;
  error?: string;
  message?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.APIMART_API_KEY;
  if (!apiKey) {
    res.status(500).json({ code: -1, error: 'APIMART_API_KEY is not configured' });
    return;
  }

  const {
    model = 'gemini-3-pro-image-preview',
    prompt,
    size = '1:1',
    n = 1,
    resolution = '1K',
    image_urls,
  } = req.body || {};

  if (!prompt) {
    res.status(400).json({ code: -1, error: 'Missing required parameter: prompt' });
    return;
  }

  // 构建请求体
  const payload: Record<string, any> = {
    model,
    prompt,
    size,
    n: typeof n === 'number' ? n : 1,
    resolution,
  };

  // 添加参考图片（可选）
  if (Array.isArray(image_urls) && image_urls.length > 0) {
    // 最多14张图片
    payload.image_urls = image_urls.slice(0, 14);
  }

  try {
    console.log('调用 Nano Image API，payload:', JSON.stringify({
      ...payload,
      image_urls: payload.image_urls?.length || 0,
    }));

    const startTime = Date.now();

    // 设置 60 秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('https://api.apimart.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;
      console.log(`Nano Image API 响应时间: ${elapsedTime}ms, 状态码: ${response.status}`);

      const data = await response.json().catch((e) => {
        console.error('解析响应 JSON 失败:', e);
        return {};
      });

      console.log('Nano Image API 原始响应:', JSON.stringify(data));

      // Apimart API 返回格式: {"code":200,"data":[{"status":"submitted","task_id":"..."}]}
      if (data.code === 200 || response.ok) {
        const resultData = data.data || data;
        console.log('Nano Image API 成功，返回数据:', JSON.stringify(resultData));
        res.status(200).json({ code: 0, data: resultData });
      } else {
        const errorMessage = data?.error?.message || data?.error || data?.message || `Request failed: ${response.status}`;
        console.error('Nano Image API 业务错误:', data.code, errorMessage, data);
        res.status(response.status || 400).json({
          code: data?.code || -1,
          error: errorMessage,
          data: data,
        });
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;

      if (fetchError.name === 'AbortError') {
        console.error(`请求超时（${elapsedTime}ms）`);
        res.status(504).json({
          code: -1,
          error: '请求超时',
          message: `Nano Image API 请求超过 60 秒未响应（已等待 ${elapsedTime}ms）`,
        });
        return;
      }

      console.error('Fetch 错误:', fetchError);
      throw fetchError;
    }
  } catch (error: any) {
    console.error('API 路由错误:', error);
    res.status(500).json({
      code: -1,
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
    });
  }
}
