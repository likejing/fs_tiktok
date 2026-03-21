'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Space, Progress, Card, Banner, Divider } from '@douyinfe/semi-ui';
import { IconStar, IconRefresh } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { getFieldStringValue, findOrCreateField } from '../../../lib/fieldUtils';
import { APIMART_VIDEO_GENERATE_API, APIMART_TASK_STATUS_API, UPLOAD_TO_OSS_API } from '../../../lib/constants';

const { Title, Text } = Typography;

// Sora2 API 参数配置
// 必填参数: model, prompt
// 可选参数: duration, aspect_ratio, image_urls, watermark, thumbnail, private, style, storyboard, character_url, character_timestamps
// 注意：当前统一使用 sora-2-pro 模型（sora-2 暂时不可用）
const SORA2_CONFIG = {
  // 支持的模型
  models: ['sora-2-pro'] as const,
  // 支持的时长（秒）：sora-2-pro 支持 10/15/25
  durations: {
    'sora-2-pro': [10, 15, 25]
  },
  // 支持的分辨率
  aspectRatios: ['16:9', '9:16'] as const,
  // 支持的视频风格
  styles: [
    { value: '', label: '默认' },
    { value: 'thanksgiving', label: '感恩节风格' },
    { value: 'comic', label: '漫画风格' },
    { value: 'news', label: '新闻风格' },
    { value: 'selfie', label: '自拍风格' },
    { value: 'nostalgic', label: '复古风格' },
    { value: 'anime', label: '动漫风格' }
  ],
  // 默认值
  defaults: {
    model: 'sora-2-pro' as const,
    duration: 10,
    aspectRatio: '16:9' as const,
    watermark: false,
    private: false
  }
};

// 表格字段配置
const FIELD_CONFIG = {
  // 必填字段
  required: {
    prompt: ['文本提示词', 'prompt', 'Prompt']  // 视频描述（必填）
  },
  // 可选字段
  optional: {
    referenceImage: ['参考图', 'reference_image', 'Image'],  // 参考图片（附件）
    orientation: ['横竖屏', 'orientation', 'Orientation'],  // 16:9 或 9:16
    duration: ['生成时长', 'duration', 'Duration'],  // 视频时长（Sora2）
    style: ['视频风格', 'style', 'Style'],  // 视频风格（Sora2）
    watermark: ['添加水印', 'watermark', 'Watermark'],  // 是否添加水印（Sora2）
    thumbnail: ['生成缩略图', 'thumbnail', 'Thumbnail'],  // 是否生成缩略图（Sora2）
    privateMode: ['隐私模式', 'private', 'Private'],  // 是否开启隐私模式（Sora2）
    storyboard: ['故事板', 'storyboard', 'Storyboard'],  // 是否使用故事板（Sora2）
    characterUrl: ['角色视频URL', 'character_url', 'CharacterUrl'],  // 参考视频角色URL（Sora2）
    characterTimestamps: ['角色时间戳', 'character_timestamps', 'CharacterTimestamps'],  // 角色出现时间戳（Sora2）
    videoModel: ['视频引擎', '视频模型', '生成模型', 'video_model', 'VideoModel'],  // Sora2 / Veo3 选择
    resolution: ['视频分辨率', '清晰度', 'resolution', 'Resolution'],  // Veo3 分辨率
    shouldGenerate: ['是否生成Sora', 'should_generate', 'ShouldGenerate']  // 控制是否生成
  },
  // 输出字段
  output: {
    sora2Video: ['Sora2视频', 'sora2_video', 'Sora2Video'],  // 生成的视频（附件）
    taskId: ['任务ID', 'task_id', 'TaskId'],  // 任务ID
    taskStatus: ['生成状态', '状态', 'status', 'Status']  // 任务状态
  }
};

export default function AIGenerate() {
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [userApiKey, setUserApiKey] = useState('');
  const formApi = useRef<BaseFormApi>();

  // 获取附件临时下载链接
  const getAttachmentTempUrls = async (table: any, field: any, recordId: string): Promise<Array<{ url: string; name: string }>> => {
    try {
      const attachmentField = await table.getFieldById(field.id);
      const attachments = await attachmentField.getValue(recordId);
      
      if (Array.isArray(attachments) && attachments.length > 0) {
        // 获取临时下载链接
        const tempUrls = await attachmentField.getAttachmentUrls(recordId);
        
        return attachments.map((att: any, index: number) => ({
          url: tempUrls[index] || att.url || att.token || '',
          name: att.name || 'unknown'
        })).filter((item: any) => item.url);
      }
      return [];
    } catch (e) {
      console.error('获取附件临时下载链接失败:', e);
      return [];
    }
  };

  // 上传文件到阿里云 OSS
  const uploadToOSS = async (fileUrl: string, fileName: string, folder?: string): Promise<string> => {
    try {
      const response = await fetch(UPLOAD_TO_OSS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl,
          fileName,
          folder: folder || 'sora-images'
        })
      });

      const result = await response.json();

      if (result.code === 0 && result.data && result.data.url) {
        return result.data.url;
      } else {
        throw new Error(result.error || result.message || '上传到OSS失败');
      }
    } catch (error: any) {
      console.error('上传到OSS失败:', error);
      throw error;
    }
  };

  // 压缩图片并转换为Base64
  const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 计算缩放比例
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // 转换为Base64
          const base64String = canvas.toDataURL('image/jpeg', quality);
          // 移除data:image/...;base64,前缀，只保留base64数据
          const base64Data = base64String.split(',')[1];
          resolve(base64Data);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 将图片URL转换为Base64（带压缩）
  const imageUrlToBase64 = async (imageUrl: string): Promise<string> => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // 创建File对象用于压缩
      const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
      
      // 压缩图片（最大1920x1920，质量80%）
      const compressedBase64 = await compressImage(file, 1920, 1920, 0.8);
      
      console.log(`图片压缩完成，原始大小: ${blob.size} bytes，压缩后Base64长度: ${compressedBase64.length}`);
      
      return compressedBase64;
    } catch (error) {
      console.error('图片转Base64失败:', error);
      throw error;
    }
  };

  // 解析布尔值字段
  const parseBooleanField = (value: string | null): boolean | undefined => {
    if (!value) return undefined;
    const v = value.toLowerCase().trim();
    if (v === '是' || v === 'true' || v === 'yes' || v === '1') return true;
    if (v === '否' || v === 'false' || v === 'no' || v === '0') return false;
    return undefined;
  };

  // 解析时长字段
  const parseDuration = (duration: string | null): number => {
    if (!duration) return SORA2_CONFIG.defaults.duration;
    const dur = duration.trim();
    if (dur.includes('25')) return 25;
    if (dur.includes('15')) return 15;
    return 10;
  };

  // 解析横竖屏字段
  const parseAspectRatio = (orientation: string | null): '16:9' | '9:16' => {
    if (!orientation) return SORA2_CONFIG.defaults.aspectRatio;
    const ori = orientation.trim();
    if (ori.includes('竖屏') || ori.toLowerCase().includes('portrait') || ori === '9:16') {
      return '9:16';
    }
    return '16:9';
  };

  // 解析视频风格字段
  const parseStyle = (style: string | null): string | undefined => {
    if (!style) return undefined;
    const s = style.toLowerCase().trim();
    const found = SORA2_CONFIG.styles.find(item => 
      item.value === s || item.label.toLowerCase().includes(s)
    );
    return found?.value || undefined;
  };

  // 解析视频引擎（Sora2 / Veo3）
  const parseVideoEngine = (model: string | null): 'sora' | 'veo' => {
    if (!model) return 'sora';
    const v = model.toLowerCase().trim();
    if (v.includes('veo')) return 'veo';
    return 'sora';
  };

  // 解析 Veo3 分辨率
  const parseVeoResolution = (resolution: string | null): '720p' | '1080p' | '4k' => {
    if (!resolution) return '720p';
    const r = resolution.toLowerCase().trim();
    if (r.includes('4k')) return '4k';
    if (r.includes('1080')) return '1080p';
    return '720p';
  };

  // 根据表格字段值构建生成参数
  interface GenerationFieldValues {
    orientation?: string | null;
    duration?: string | null;
    style?: string | null;
    watermark?: string | null;
    thumbnail?: string | null;
    privateMode?: string | null;
    storyboard?: string | null;
    characterUrl?: string | null;
    characterTimestamps?: string | null;
    videoModel?: string | null;
    resolution?: string | null;
  }

  const buildGenerationPayload = (
    prompt: string,
    imageUrls: string[],
    fieldValues: GenerationFieldValues
  ) => {
    // 解析视频引擎（默认使用 Sora2，可通过「视频引擎」字段切换 Veo3）
    const engine = parseVideoEngine(fieldValues.videoModel || null);

    // 解析通用字段
    const durationSec = engine === 'veo'
      ? 8
      : parseDuration(fieldValues.duration || null);
    const aspectRatio = parseAspectRatio(fieldValues.orientation || null);

    // 根据引擎选择模型
    // 注意：sora-2 暂时不可用，统一使用 sora-2-pro
    const model =
      engine === 'veo'
        ? 'veo3.1-fast'
        : 'sora-2-pro';

    // 构建必填参数
    const payload: Record<string, any> = {
      model,
      prompt
    };

    // 通用参数
    payload.duration = durationSec;
    payload.aspect_ratio = aspectRatio;

    if (imageUrls.length > 0) {
      // Veo3 最多支持 3 张参考图
      payload.image_urls = engine === 'veo' ? imageUrls.slice(0, 3) : imageUrls;
    }

    if (engine === 'sora') {
      const style = parseStyle(fieldValues.style || null);
      const watermark = parseBooleanField(fieldValues.watermark || null);
      const thumbnail = parseBooleanField(fieldValues.thumbnail || null);
      const privateMode = parseBooleanField(fieldValues.privateMode || null);
      const storyboard = parseBooleanField(fieldValues.storyboard || null);

      if (style) {
        payload.style = style;
      }

      if (watermark !== undefined) {
        payload.watermark = watermark;
      }

      if (thumbnail !== undefined) {
        payload.thumbnail = thumbnail;
      }

      if (privateMode !== undefined) {
        payload.private = privateMode;
      }

      if (storyboard !== undefined) {
        payload.storyboard = storyboard;
      }

      // 角色相关参数（仅 Sora2 支持）
      if (fieldValues.characterUrl) {
        payload.character_url = fieldValues.characterUrl.trim();
      }

      if (fieldValues.characterTimestamps) {
        payload.character_timestamps = fieldValues.characterTimestamps.trim();
      }
    } else {
      // Veo3 专属参数：分辨率与生成模式
      payload.resolution = parseVeoResolution(fieldValues.resolution || null);
      if (payload.image_urls && Array.isArray(payload.image_urls)) {
        if (payload.image_urls.length === 2) {
          payload.generation_type = 'frame';
        } else if (payload.image_urls.length >= 3) {
          payload.generation_type = 'reference';
        }
      }
    }

    console.log('📝 生成参数:', {
      model: payload.model,
      prompt: payload.prompt.substring(0, 50) + '...',
      duration: payload.duration,
      aspect_ratio: payload.aspect_ratio,
      image_urls: payload.image_urls?.length || 0,
      style: payload.style,
      watermark: payload.watermark,
      thumbnail: payload.thumbnail,
      private: payload.private,
      storyboard: payload.storyboard,
      character_url: payload.character_url ? '已设置' : undefined,
      character_timestamps: payload.character_timestamps,
      resolution: payload.resolution,
      generation_type: payload.generation_type
    });

    return payload;
  };

  // 调用 Apimart 视频生成接口（返回异步任务）
  const createApimartTask = async (payload: any): Promise<{ status: string; task_id: string }> => {
    try {
      console.log('提交生成任务，payload:', JSON.stringify({ 
        ...payload, 
        image_urls: payload.image_urls?.length || 0,
        image_urls_preview: payload.image_urls?.slice(0, 2) || []
      }));
      
      const startTime = Date.now();
      
      // 设置 90 秒超时（前端超时，给后端更多时间）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(APIMART_VIDEO_GENERATE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...payload, user_api_key: userApiKey.trim() }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsedTime = Date.now() - startTime;
      console.log(`请求耗时: ${elapsedTime}ms, 状态码: ${response.status}`);

      // 检查响应状态
      if (!response.ok) {
        let errorText = '';
        let errorData: any = {};
        try {
          errorData = await response.json();
          errorText = errorData?.error || errorData?.message || `HTTP ${response.status}`;
        } catch {
          errorText = await response.text().catch(() => `HTTP ${response.status}`);
        }
        
        // 524 是网关超时错误
        if (response.status === 524) {
          throw new Error(`请求超时（${elapsedTime}ms）：网关超时。可能原因：1) 图片 URL 无法被 Apimart API 访问（需要公网可访问的 URL）；2) 服务器处理时间过长。请检查图片 URL 或稍后重试`);
        }
        
        console.error('API 错误响应:', response.status, errorText, errorData);
        throw new Error(`请求失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('API 响应数据:', JSON.stringify(result));

      // 积分不足或密钥无效
      if (result.code === -2) {
        throw new Error(result.error || '积分不足，请添加微信 GOV156 充值积分');
      }

      // 检查业务状态码（Apimart 返回 code: 200 表示成功）
      if (result.code !== 0 && result.code !== 200) {
        const errMsg = result?.error || result?.message || '未知错误';
        throw new Error(`业务错误 (code: ${result.code}): ${errMsg}`);
      }

      // 提取任务数据
      const taskData = result.data;
      if (!taskData) {
        throw new Error('未返回任务数据，响应: ' + JSON.stringify(result));
      }

      // 处理数组或对象格式
      const task = Array.isArray(taskData) ? taskData[0] : taskData;
      if (!task?.task_id) {
        throw new Error('未返回任务ID，响应数据: ' + JSON.stringify(taskData));
      }

      console.log(`✅ 任务创建成功: task_id=${task.task_id}, status=${task.status}`);
      return { status: task.status || 'submitted', task_id: task.task_id };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时：超过 90 秒未响应，请检查网络连接或图片 URL 是否可访问');
      }
      console.error('createApimartTask 错误:', error);
      throw error;
    }
  };

  // 根据任务ID获取任务状态和结果
  const fetchApimartTaskStatus = async (taskId: string) => {
    const url = `${APIMART_TASK_STATUS_API}?task_id=${encodeURIComponent(taskId)}&language=zh`;
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok || result.code !== 0) {
      const errMsg = result?.error || result?.message || `请求失败: ${response.status}`;
      throw new Error(errMsg);
    }

    return result.data;
  };

  // 生成Sora2视频
  const handleGenerateSora2 = useCallback(async ({
    table: tableId
  }: {
    table: string;
  }) => {
    if (!tableId) {
      Toast.error('请先选择数据表');
      return;
    }

    if (!userApiKey.trim()) {
      Toast.error('请输入密钥');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始提交AI视频生成任务...');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    try {
      const table = await bitable.base.getTableById(tableId);
      let fieldList = await table.getFieldList();

      // 查找字段的辅助函数
      const findFieldByNames = async (names: string[]): Promise<any> => {
        for (const field of fieldList) {
          try {
            const fieldName = await field.getName();
            if (names.some(n => n.toLowerCase() === fieldName.toLowerCase())) {
              return field;
            }
          } catch (e) {
            // 忽略错误
          }
        }
        // 尝试通过 getFieldByName 获取
        for (const name of names) {
          try {
            return await table.getFieldByName(name);
          } catch (e) {
            // 继续尝试下一个名称
          }
        }
        return null;
      };

      // === 必填字段 ===
      const promptField = await findFieldByNames(FIELD_CONFIG.required.prompt);
      if (!promptField) {
        Toast.error('数据表中未找到"文本提示词"字段（必填）');
        setLoading(false);
        return;
      }

      // === 可选字段 ===
      const referenceImageField = await findFieldByNames(FIELD_CONFIG.optional.referenceImage);
      const orientationField = await findFieldByNames(FIELD_CONFIG.optional.orientation);
      const durationField = await findFieldByNames(FIELD_CONFIG.optional.duration);
      const styleField = await findFieldByNames(FIELD_CONFIG.optional.style);
      const watermarkField = await findFieldByNames(FIELD_CONFIG.optional.watermark);
      const thumbnailField = await findFieldByNames(FIELD_CONFIG.optional.thumbnail);
      const privateModeField = await findFieldByNames(FIELD_CONFIG.optional.privateMode);
      const storyboardField = await findFieldByNames(FIELD_CONFIG.optional.storyboard);
      const characterUrlField = await findFieldByNames(FIELD_CONFIG.optional.characterUrl);
      const characterTimestampsField = await findFieldByNames(FIELD_CONFIG.optional.characterTimestamps);
      const videoModelField = await findFieldByNames(FIELD_CONFIG.optional.videoModel);
      const resolutionField = await findFieldByNames(FIELD_CONFIG.optional.resolution);
      const shouldGenerateField = await findFieldByNames(FIELD_CONFIG.optional.shouldGenerate);

      // === 输出字段（自动创建如果不存在） ===
      let sora2VideoField = await findFieldByNames(FIELD_CONFIG.output.sora2Video);
      if (!sora2VideoField) {
        sora2VideoField = await findOrCreateField(table, fieldList, 'Sora2视频', FieldType.Attachment);
        if (!sora2VideoField) {
          Toast.error('无法创建或获取 Sora2视频 字段');
          setLoading(false);
          return;
        }
        fieldList = await table.getFieldList();
      }

      let taskIdField = await findFieldByNames(FIELD_CONFIG.output.taskId);
      if (!taskIdField) {
        taskIdField = await findOrCreateField(table, fieldList, '任务ID', FieldType.Text);
        fieldList = await table.getFieldList();
      }

      let taskStatusField = await findFieldByNames(FIELD_CONFIG.output.taskStatus);
      if (!taskStatusField) {
        taskStatusField = await findOrCreateField(table, fieldList, '生成状态', FieldType.Text);
        fieldList = await table.getFieldList();
      }

      // 日志：字段检测结果
      console.log('📋 字段检测结果:', {
        '必填': { '文本提示词': !!promptField },
        '可选': {
          '参考图': !!referenceImageField,
          '横竖屏': !!orientationField,
          '生成时长': !!durationField,
          '视频风格': !!styleField,
          '添加水印': !!watermarkField,
          '生成缩略图': !!thumbnailField,
          '隐私模式': !!privateModeField,
          '故事板': !!storyboardField,
          '角色视频URL': !!characterUrlField,
          '角色时间戳': !!characterTimestampsField,
          '视频引擎': !!videoModelField,
          '视频分辨率': !!resolutionField,
          '是否生成Sora': !!shouldGenerateField
        },
        '输出': {
          'Sora2视频': !!sora2VideoField,
          '任务ID': !!taskIdField,
          '生成状态': !!taskStatusField
        }
      });

      // 参考图字段是可选的（支持文生视频）
      if (!referenceImageField) {
        console.log('ℹ️ 未找到"参考图"字段，将仅支持文生视频');
      }

      // 获取所有记录
      const records = await table.getRecords({ pageSize: 5000 });
      const totalRecords = records.records.length;

      console.log(`开始处理 ${totalRecords} 条记录`);

      // 遍历每条记录
      for (let i = 0; i < totalRecords; i++) {
        const record = records.records[i];
        const recordId = record.recordId;

        setProgress(Math.round(((i + 1) / totalRecords) * 100));
        setStatus(`正在处理记录 ${i + 1}/${totalRecords}...`);

        try {
          // 检查是否应该生成
          if (shouldGenerateField) {
            const shouldGenerate = await getFieldStringValue(table, shouldGenerateField, recordId);
            if (shouldGenerate !== '是' && shouldGenerate !== 'true' && shouldGenerate !== 'True') {
              console.log(`记录 ${recordId} 的"是否生成Sora"为否，跳过`);
              skipCount++;
              continue;
            }
          }

          // 检查是否已有视频
          if (sora2VideoField) {
            try {
              const attachmentField = await table.getFieldById(sora2VideoField.id);
              const existingAttachments = await attachmentField.getValue(recordId);
              if (Array.isArray(existingAttachments) && existingAttachments.length > 0) {
                console.log(`记录 ${recordId} 已有Sora2视频，跳过`);
                skipCount++;
                continue;
              }
            } catch (e) {
              console.warn(`检查已有视频失败:`, e);
            }
          }

          // 已有任务ID的记录不再重复提交
          if (taskIdField) {
            try {
              const existingTaskId = await getFieldStringValue(table, taskIdField, recordId);
              if (existingTaskId) {
                console.log(`记录 ${recordId} 已有任务ID(${existingTaskId})，跳过提交`);
                skipCount++;
                continue;
              }
            } catch (e) {
              console.warn(`检查任务ID失败:`, e);
            }
          }

          // 获取文本提示词（必填）
          const prompt = await getFieldStringValue(table, promptField, recordId);
          if (!prompt) {
            console.log(`记录 ${recordId} 缺少文本提示词（必填），跳过`);
            skipCount++;
            continue;
          }

          // 获取所有可选字段值
          const fieldValues: GenerationFieldValues = {
            orientation: orientationField ? await getFieldStringValue(table, orientationField, recordId) : null,
            duration: durationField ? await getFieldStringValue(table, durationField, recordId) : null,
            style: styleField ? await getFieldStringValue(table, styleField, recordId) : null,
            watermark: watermarkField ? await getFieldStringValue(table, watermarkField, recordId) : null,
            thumbnail: thumbnailField ? await getFieldStringValue(table, thumbnailField, recordId) : null,
            privateMode: privateModeField ? await getFieldStringValue(table, privateModeField, recordId) : null,
            storyboard: storyboardField ? await getFieldStringValue(table, storyboardField, recordId) : null,
            characterUrl: characterUrlField ? await getFieldStringValue(table, characterUrlField, recordId) : null,
            characterTimestamps: characterTimestampsField ? await getFieldStringValue(table, characterTimestampsField, recordId) : null,
            videoModel: videoModelField ? await getFieldStringValue(table, videoModelField, recordId) : null,
            resolution: resolutionField ? await getFieldStringValue(table, resolutionField, recordId) : null,
          };

          // 获取参考图URL（可选，多张取全部）
          const imageAttachments = referenceImageField ? await getAttachmentTempUrls(table, referenceImageField, recordId) : [];
          console.log(`处理记录 ${recordId}，提示词: ${prompt.substring(0, 50)}...，参考图数量: ${imageAttachments.length}`);
          
          // 先将图片上传到 OSS，获取公网可访问的 URL
          const imageUrls: string[] = [];
          if (imageAttachments.length > 0) {
            setStatus(`正在上传 ${imageAttachments.length} 张图片到 OSS...`);
            let uploadSuccessCount = 0;
            let uploadFailCount = 0;
            
            for (let j = 0; j < imageAttachments.length; j++) {
              const attachment = imageAttachments[j];
              try {
                console.log(`上传图片 ${j + 1}/${imageAttachments.length}: ${attachment.name}`);
                setStatus(`正在上传图片 ${j + 1}/${imageAttachments.length}...`);
                const ossUrl = await uploadToOSS(attachment.url, attachment.name, 'sora-images');
                imageUrls.push(ossUrl);
                uploadSuccessCount++;
                console.log(`✅ 图片上传成功: ${ossUrl}`);
              } catch (error: any) {
                uploadFailCount++;
                console.error(`上传图片 ${attachment.name} 失败:`, error);
                Toast.warning(`记录 ${recordId} 的图片 "${attachment.name}" 上传到 OSS 失败: ${error.message || '未知错误'}`);
              }
            }
            
            if (imageUrls.length === 0 && imageAttachments.length > 0) {
              console.warn(`⚠️ 所有图片上传失败，跳过该记录`);
              Toast.error(`记录 ${recordId} 的所有图片上传失败，跳过生成`);
              errorCount++;
              continue;
            }
            
            if (uploadFailCount > 0) {
              Toast.warning(`记录 ${recordId}: 成功上传 ${uploadSuccessCount} 张，失败 ${uploadFailCount} 张`);
            }
            
            console.log(`✅ 成功上传 ${imageUrls.length}/${imageAttachments.length} 张图片到 OSS`);
          }

          // 构建生成参数并调用 API
          setStatus(`正在提交生成任务...`);
          const payload = buildGenerationPayload(prompt, imageUrls, fieldValues);
          const task = await createApimartTask(payload);

          // 写回任务ID与状态
          if (taskIdField) {
            await table.setCellValue(taskIdField.id, recordId, task.task_id);
          }
          if (taskStatusField) {
            await table.setCellValue(taskStatusField.id, recordId, task.status || 'submitted');
          }

          console.log(`✅ 记录 ${recordId} 任务创建成功，task_id=${task.task_id}, status=${task.status}`);
          successCount++;
        } catch (error: any) {
          console.error(`处理记录 ${recordId} 失败:`, error);
          errorCount++;
          Toast.error(`记录 ${recordId} 生成失败: ${error.message || '未知错误'}`);
        }
      }

      // 显示结果
      Toast.success(`生成完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`);
      setStatus(`生成完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`);
    } catch (error: any) {
      console.error('生成Sora2视频失败:', error);
      Toast.error(`生成失败: ${error.message || '未知错误'}`);
      setStatus(`生成失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新任务状态并在完成后保存视频附件
  const handleUpdateTaskStatus = useCallback(async ({ 
    table: tableId 
  }: { 
    table: string;
  }) => {
    if (!tableId) {
      Toast.error('请先选择数据表');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始更新任务状态...');

    let updatedCount = 0;
    let completedCount = 0;
    let errorCount = 0;

    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldList = await table.getFieldList();

      // 查找相关字段
      let taskIdField: any = null;
      let taskStatusField: any = null;
      let sora2VideoField: any = null;

      for (const field of fieldList) {
        try {
          const name = await field.getName();
          if (name === '任务ID' || name === 'task_id' || name === 'Task ID') {
            taskIdField = field;
          } else if (name === '生成状态' || name === '状态' || (typeof name === 'string' && name.toLowerCase() === 'status')) {
            taskStatusField = field;
          } else if (name === 'Sora2视频' || name === 'sora2_video') {
            sora2VideoField = field;
          }
        } catch (e) {
          console.warn('获取字段名称失败:', e);
        }
      }

      if (!taskIdField) {
        Toast.error('未找到“任务ID”字段，无法更新任务状态');
        setLoading(false);
        return;
      }

      const records = await table.getRecords({ pageSize: 5000 });
      const total = records.records.length;

      for (let i = 0; i < total; i++) {
        const record = records.records[i];
        const recordId = record.recordId;

        setProgress(Math.round(((i + 1) / total) * 100));
        setStatus(`正在更新任务状态 ${i + 1}/${total}...`);

        try {
          const taskId = await getFieldStringValue(table, taskIdField, recordId);
          if (!taskId) {
            continue;
          }

          const data = await fetchApimartTaskStatus(String(taskId).trim());
          const statusValue = data.status || '';
          updatedCount++;

          if (taskStatusField) {
            await table.setCellValue(taskStatusField.id, recordId, statusValue);
          }

          // 如果任务已完成且有视频结果，下载并保存到附件字段
          if (statusValue === 'completed' && sora2VideoField && data.result && Array.isArray(data.result.videos)) {
            const attachmentField = await table.getFieldById(sora2VideoField.id);

            // 如果已经有视频附件则跳过
            try {
              const existingAttachments = await attachmentField.getValue(recordId);
              if (Array.isArray(existingAttachments) && existingAttachments.length > 0) {
                console.log(`记录 ${recordId} 状态已完成且已有视频附件，跳过保存`);
                completedCount++;
                continue;
              }
            } catch (attachmentError) {
              console.warn(`检查记录 ${recordId} 现有附件失败:`, attachmentError);
            }

            const firstVideo = data.result.videos[0];
            const urlArray = firstVideo?.url;
            const videoUrl = Array.isArray(urlArray) ? urlArray[0] : null;

            if (videoUrl) {
              try {
                const videoResponse = await fetch(videoUrl);
                if (!videoResponse.ok) {
                  throw new Error(`下载视频失败: ${videoResponse.status} ${videoResponse.statusText}`);
                }
                const blob = await videoResponse.blob();
                const fileName = `sora2_video_${Date.now()}.mp4`;
                const file = new File([blob], fileName, { type: 'video/mp4' });

                await attachmentField.setValue(recordId, file);

                completedCount++;
                console.log(`✅ 记录 ${recordId} 状态完成并已保存视频附件`);
              } catch (e) {
                console.error(`记录 ${recordId} 保存视频失败:`, e);
              }
            }
          }
        } catch (e: any) {
          errorCount++;
          console.error(`更新记录 ${recordId} 任务状态失败:`, e);
        }
      }

      Toast.success(`任务状态更新完成！更新: ${updatedCount}，已完成并保存视频: ${completedCount}，失败: ${errorCount}`);
      setStatus(`任务状态更新完成！更新: ${updatedCount}，已完成并保存视频: ${completedCount}，失败: ${errorCount}`);
    } catch (error: any) {
      console.error('更新任务状态失败:', error);
      Toast.error(`更新任务状态失败: ${error.message || '未知错误'}`);
      setStatus(`更新任务状态失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      bitable.base.getTableMetaList(),
      bitable.base.getSelection()
    ]).then(([metaList, selection]) => {
      setTableMetaList(metaList);
      const defaultTable = metaList.find(meta => meta.name === 'AI素材生成');
      const initialTableId = defaultTable?.id || selection.tableId;
      if (initialTableId) {
        formApi.current?.setValues({ table: initialTableId });
      }
    });
  }, []);

  // 样式常量 - 遵循 Base 开放设计规范
  const styles = {
    container: { padding: '0 4px' },
    header: { marginBottom: 16 },
    card: { marginBottom: 16, borderRadius: 8 },
    cardBody: { padding: '16px 20px' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    infoCard: { backgroundColor: 'var(--semi-color-fill-0)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
    fieldList: { display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 8 },
    fieldTag: { padding: '2px 8px', borderRadius: 4, fontSize: 12, backgroundColor: 'var(--semi-color-primary-light-default)', color: 'var(--semi-color-primary)' },
    fieldTagWarning: { padding: '2px 8px', borderRadius: 4, fontSize: 12, backgroundColor: 'var(--semi-color-warning-light-default)', color: 'var(--semi-color-warning)' },
    fieldTagSuccess: { padding: '2px 8px', borderRadius: 4, fontSize: 12, backgroundColor: 'var(--semi-color-success-light-default)', color: 'var(--semi-color-success)' },
    buttonGroup: { display: 'flex', gap: 12, marginTop: 16 },
    progressContainer: { marginTop: 16, marginBottom: 8 },
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <Title heading={5} style={{ marginBottom: 4, color: 'var(--semi-color-text-0)' }}>
          AI 视频生成
        </Title>
        <Text type="tertiary" size="small">
          使用 Sora2 Pro / Veo3 模型生成高质量视频内容（当前统一使用 Sora2 Pro）
        </Text>
      </div>

      {/* 生成配置卡片 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <div style={styles.sectionTitle}>
          <IconStar style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>生成配置</Text>
        </div>

        <Form
          getFormApi={(api) => formApi.current = api}
          labelPosition='top'
        >
          {/* 密钥输入 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>密钥</Text>
            <input
              type="password"
              placeholder="请输入密钥（积分不足请添加微信 GOV156 充值）"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--semi-color-border)',
                background: 'var(--semi-color-bg-2)',
                color: 'var(--semi-color-text-0)',
                fontSize: 14,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <Form.Select
            field='table'
            label='数据表'
            placeholder="选择包含提示词的数据表"
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择数据表' }]}
            optionList={tableMetaList?.map(({ name, id }) => ({ label: name, value: id }))}
          />

          {/* 进度显示 */}
          {loading && (
            <div style={styles.progressContainer}>
              <Progress 
                percent={progress} 
                showInfo 
                style={{ marginBottom: 8 }}
                stroke='var(--semi-color-primary)'
              />
              <Text type="tertiary" size="small">{status}</Text>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={styles.buttonGroup}>
            <Button 
              onClick={() => {
                const values = formApi.current?.getValues() || {};
                handleGenerateSora2({ table: values.table });
              }}
              loading={loading}
              icon={<IconStar />}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              生成视频
            </Button>
            <Button
              onClick={() => {
                const values = formApi.current?.getValues() || {};
                handleUpdateTaskStatus({ table: values.table });
              }}
              loading={loading}
              icon={<IconRefresh />}
              className="btn-secondary"
              style={{ flex: 1 }}
            >
              更新状态
            </Button>
          </div>
        </Form>
      </Card>

      {/* 字段说明卡片 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <Text strong size="small" style={{ color: 'var(--semi-color-text-0)', display: 'block', marginBottom: 12 }}>
          字段说明
        </Text>

        {/* 必填字段 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>必填字段</Text>
          <div style={styles.fieldList}>
            <span style={styles.fieldTagWarning}>文本提示词</span>
          </div>
        </div>

        {/* 可选字段 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>可选字段</Text>
          <div style={styles.fieldList}>
            <span style={styles.fieldTag}>参考图</span>
            <span style={styles.fieldTag}>横竖屏</span>
            <span style={styles.fieldTag}>生成时长</span>
            <span style={styles.fieldTag}>视频风格</span>
            <span style={styles.fieldTag}>添加水印</span>
            <span style={styles.fieldTag}>视频引擎</span>
            <span style={styles.fieldTag}>视频分辨率</span>
            <span style={styles.fieldTag}>是否生成Sora</span>
          </div>
        </div>

        {/* 输出字段 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>输出字段（自动创建）</Text>
          <div style={styles.fieldList}>
            <span style={styles.fieldTagSuccess}>Sora2视频</span>
            <span style={styles.fieldTagSuccess}>任务ID</span>
            <span style={styles.fieldTagSuccess}>生成状态</span>
          </div>
        </div>
      </Card>

      {/* 提示信息 */}
      <Banner 
        type="warning"
        description="视频链接有效期24小时，请及时点击更新状态保存视频。"
        style={{ borderRadius: 8 }}
      />
    </div>
  );
}

