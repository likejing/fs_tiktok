'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Space, Progress, Card, Banner, Divider } from '@douyinfe/semi-ui';
import { IconImage, IconRefresh } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { getFieldStringValue, findOrCreateField } from '../../../lib/fieldUtils';
import { APIMART_NANO_IMAGE_API, APIMART_TASK_STATUS_API, UPLOAD_TO_OSS_API, PROXY_DOWNLOAD_API } from '../../../lib/constants';

const { Title, Text } = Typography;

// Nano API 参数配置
const NANO_CONFIG = {
  model: 'gemini-3-pro-image-preview',
  // 支持的尺寸比例
  sizes: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const,
  // 支持的分辨率
  resolutions: ['1K', '2K', '4K'] as const,
  // 默认值
  defaults: {
    size: '1:1' as const,
    resolution: '1K' as const,
    n: 1,
  }
};

// 默认选中的数据表名称（若多维表格中存在同名表则自动选中）
const DEFAULT_TABLE_NAME = 'Nano图像生成';

// 表格字段配置
const FIELD_CONFIG = {
  // 必填字段
  required: {
    prompt: ['图像提示词', 'prompt', 'Prompt', '提示词']  // 图像描述（必填）
  },
  // 可选字段
  optional: {
    referenceImage: ['参考图', 'reference_image', 'Image', '参考图片'],  // 参考图片（附件）
    size: ['图片比例', 'size', 'Size', '尺寸比例'],  // 1:1, 16:9 等
    resolution: ['分辨率', 'resolution', 'Resolution'],  // 1K, 2K, 4K
    shouldGenerate: ['是否生成Nano', 'should_generate_nano', 'ShouldGenerateNano', '是否生成图像']  // 控制是否生成
  },
  // 输出字段
  output: {
    nanoImage: ['Nano图像', 'nano_image', 'NanoImage', '生成图像'],  // 生成的图像（附件）
    taskId: ['Nano任务ID', 'nano_task_id', 'NanoTaskId'],  // 任务ID
    taskStatus: ['Nano生成状态', 'nano_status', 'NanoStatus', '图像生成状态']  // 任务状态
  }
};

// 样式定义
const styles = {
  container: {
    padding: '0 4px',
  },
  infoCard: {
    backgroundColor: 'var(--semi-color-fill-0)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
  },
  stepItem: {
    marginBottom: 4,
    color: 'var(--semi-color-text-2)',
    fontSize: 13,
    lineHeight: '20px',
  },
  fieldTag: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  fieldTagPrimary: {
    backgroundColor: 'var(--semi-color-primary-light-default)',
    color: 'var(--semi-color-primary)',
  },
  fieldTagSecondary: {
    backgroundColor: 'var(--semi-color-tertiary-light-default)',
    color: 'var(--semi-color-tertiary)',
  },
  buttonGroup: {
    display: 'flex',
    gap: 12,
    marginTop: 20,
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
};

export default function NanoGenerate() {
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const formApi = useRef<BaseFormApi>();

  // 获取附件临时下载链接
  const getAttachmentTempUrls = async (table: any, field: any, recordId: string): Promise<Array<{ url: string; name: string }>> => {
    try {
      const attachmentField = await table.getFieldById(field.id);
      const attachments = await attachmentField.getValue(recordId);
      
      if (Array.isArray(attachments) && attachments.length > 0) {
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
          folder: folder || 'nano-images'
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

  // 解析尺寸字段
  const parseSize = (size: string | null): string => {
    if (!size) return NANO_CONFIG.defaults.size;
    const s = size.trim();
    // 检查是否是支持的尺寸
    const found = NANO_CONFIG.sizes.find(item => item === s);
    if (found) return found;
    // 尝试匹配常见描述
    if (s.includes('竖屏') || s.toLowerCase().includes('portrait')) return '9:16';
    if (s.includes('横屏') || s.toLowerCase().includes('landscape')) return '16:9';
    if (s.includes('方形') || s.toLowerCase().includes('square')) return '1:1';
    return NANO_CONFIG.defaults.size;
  };

  // 解析分辨率字段
  const parseResolution = (resolution: string | null): string => {
    if (!resolution) return NANO_CONFIG.defaults.resolution;
    const r = resolution.toUpperCase().trim();
    if (r.includes('4K')) return '4K';
    if (r.includes('2K')) return '2K';
    return '1K';
  };

  // 查找字段（支持多个候选名称）
  const findFieldByNames = (fieldList: any[], fieldNames: string[]): any | null => {
    for (const name of fieldNames) {
      const field = fieldList.find(f => f.name === name);
      if (field) return field;
    }
    return null;
  };

  // 批量生成图像
  const handleBatchGenerate = useCallback(async ({
    dataTable: dataTableId,
  }: {
    dataTable: string;
  }) => {
    if (!dataTableId) {
      Toast.error('请选择数据表');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('正在初始化...');

    try {
      const table = await bitable.base.getTableById(dataTableId);
      const fieldList = await table.getFieldMetaList();

      // 查找必填字段 - 提示词
      const promptField = findFieldByNames(fieldList, FIELD_CONFIG.required.prompt);
      if (!promptField) {
        Toast.error(`未找到提示词字段，请确保表中包含以下字段之一：${FIELD_CONFIG.required.prompt.join('、')}`);
        setLoading(false);
        return;
      }

      // 查找可选字段
      const referenceImageField = findFieldByNames(fieldList, FIELD_CONFIG.optional.referenceImage);
      const sizeField = findFieldByNames(fieldList, FIELD_CONFIG.optional.size);
      const resolutionField = findFieldByNames(fieldList, FIELD_CONFIG.optional.resolution);
      const shouldGenerateField = findFieldByNames(fieldList, FIELD_CONFIG.optional.shouldGenerate);

      // 确保输出字段存在
      let currentFieldList = [...fieldList];
      const taskIdField = await findOrCreateField(table, currentFieldList, FIELD_CONFIG.output.taskId[0], FieldType.Text);
      currentFieldList = await table.getFieldMetaList();
      const taskStatusField = await findOrCreateField(table, currentFieldList, FIELD_CONFIG.output.taskStatus[0], FieldType.Text);
      currentFieldList = await table.getFieldMetaList();
      const nanoImageField = await findOrCreateField(table, currentFieldList, FIELD_CONFIG.output.nanoImage[0], FieldType.Attachment);

      // 获取所有记录
      const records = await table.getRecords({ pageSize: 5000 });
      const allRecords = records.records;

      // 筛选需要生成的记录
      const recordsToGenerate: any[] = [];

      for (const record of allRecords) {
        // 检查是否有提示词
        const prompt = await getFieldStringValue(table, promptField, record.recordId);
        if (!prompt) continue;

        // 检查是否需要生成（如果有控制字段）
        if (shouldGenerateField) {
          const shouldGenerate = await getFieldStringValue(table, shouldGenerateField, record.recordId);
          if (shouldGenerate) {
            const sg = shouldGenerate.toLowerCase().trim();
            if (sg === '否' || sg === 'false' || sg === 'no' || sg === '0') {
              continue;
            }
          }
        }

        // 检查是否已有任务ID（避免重复生成）
        const existingTaskId = await getFieldStringValue(table, taskIdField, record.recordId);
        if (existingTaskId) {
          console.log(`记录 ${record.recordId} 已有任务ID，跳过`);
          continue;
        }

        recordsToGenerate.push(record);
      }

      if (recordsToGenerate.length === 0) {
        Toast.warning('没有需要生成的记录（所有记录都已有任务ID或提示词为空）');
        setLoading(false);
        return;
      }

      setStatus(`找到 ${recordsToGenerate.length} 条需要生成的记录`);

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < recordsToGenerate.length; i++) {
        const record = recordsToGenerate[i];
        const progressPercent = Math.round(((i + 1) / recordsToGenerate.length) * 100);
        setProgress(progressPercent);
        setStatus(`正在处理 ${i + 1}/${recordsToGenerate.length}...`);

        try {
          // 获取提示词
          const prompt = await getFieldStringValue(table, promptField, record.recordId);
          if (!prompt) continue;

          // 获取可选参数
          const sizeValue = sizeField ? await getFieldStringValue(table, sizeField, record.recordId) : null;
          const resolutionValue = resolutionField ? await getFieldStringValue(table, resolutionField, record.recordId) : null;

          // 获取参考图片（如果有）
          let imageUrls: string[] = [];
          if (referenceImageField) {
            const attachments = await getAttachmentTempUrls(table, referenceImageField, record.recordId);
            if (attachments.length > 0) {
              setStatus(`正在上传参考图片到 OSS...`);
              for (const att of attachments.slice(0, 14)) {  // 最多14张
                try {
                  const ossUrl = await uploadToOSS(att.url, att.name, 'nano-reference');
                  imageUrls.push(ossUrl);
                } catch (e) {
                  console.warn('上传参考图片失败:', e);
                }
              }
            }
          }

          // 构建请求参数
          const payload = {
            model: NANO_CONFIG.model,
            prompt: prompt,
            size: parseSize(sizeValue),
            resolution: parseResolution(resolutionValue),
            n: 1,
            image_urls: imageUrls.length > 0 ? imageUrls : undefined,
          };

          console.log('Nano 生成请求:', payload);

          // 调用 API
          const response = await fetch(APIMART_NANO_IMAGE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const result = await response.json();

          if (result.code === 0 && result.data) {
            // 获取任务ID
            const taskData = Array.isArray(result.data) ? result.data[0] : result.data;
            const taskId = taskData?.task_id;

            if (taskId) {
              // 更新记录
              await table.setRecord(record.recordId, {
                fields: {
                  [taskIdField.id]: taskId,
                  [taskStatusField.id]: '已提交',
                }
              });
              successCount++;
              console.log(`记录 ${record.recordId} 生成任务已提交，task_id: ${taskId}`);
            } else {
              throw new Error('未获取到任务ID');
            }
          } else {
            throw new Error(result.error || result.message || '生成失败');
          }
        } catch (e: any) {
          console.error(`记录 ${record.recordId} 生成失败:`, e);
          failCount++;
          // 更新状态为失败
          try {
            await table.setRecord(record.recordId, {
              fields: {
                [taskStatusField.id]: `生成失败: ${e.message || '未知错误'}`,
              }
            });
          } catch (updateError) {
            console.error('更新失败状态失败:', updateError);
          }
        }
      }

      setStatus(`完成！成功: ${successCount}, 失败: ${failCount}`);
      Toast.success(`批量生成完成！成功: ${successCount}, 失败: ${failCount}`);
    } catch (error: any) {
      console.error('批量生成失败:', error);
      Toast.error(`批量生成失败: ${error.message || '未知错误'}`);
      setStatus(`生成失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新任务状态
  const handleUpdateStatus = useCallback(async () => {
    const formValues = formApi.current?.getValues();
    const dataTableId = formValues?.dataTable;

    if (!dataTableId) {
      Toast.error('请选择数据表');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('正在查询任务状态...');

    try {
      const table = await bitable.base.getTableById(dataTableId);
      const fieldList = await table.getFieldMetaList();

      // 查找输出字段
      const taskIdField = findFieldByNames(fieldList, FIELD_CONFIG.output.taskId);
      const taskStatusField = findFieldByNames(fieldList, FIELD_CONFIG.output.taskStatus);
      const nanoImageField = findFieldByNames(fieldList, FIELD_CONFIG.output.nanoImage);

      if (!taskIdField) {
        Toast.error('未找到任务ID字段');
        setLoading(false);
        return;
      }

      // 获取所有记录
      const records = await table.getRecords({ pageSize: 5000 });
      const allRecords = records.records;

      // 筛选有任务ID但状态不是"已完成"的记录
      const recordsToUpdate: any[] = [];

      for (const record of allRecords) {
        const taskId = await getFieldStringValue(table, taskIdField, record.recordId);
        if (!taskId) continue;

        const currentStatus = taskStatusField ? await getFieldStringValue(table, taskStatusField, record.recordId) : null;
        // 跳过已完成或已失败的
        if (currentStatus === '已完成' || currentStatus?.includes('失败')) continue;

        recordsToUpdate.push({ record, taskId });
      }

      if (recordsToUpdate.length === 0) {
        Toast.info('没有需要更新状态的任务');
        setLoading(false);
        return;
      }

      setStatus(`找到 ${recordsToUpdate.length} 条需要更新的任务`);

      let completedCount = 0;
      let pendingCount = 0;
      let failedCount = 0;

      for (let i = 0; i < recordsToUpdate.length; i++) {
        const { record, taskId } = recordsToUpdate[i];
        const progressPercent = Math.round(((i + 1) / recordsToUpdate.length) * 100);
        setProgress(progressPercent);
        setStatus(`正在查询 ${i + 1}/${recordsToUpdate.length}...`);

        try {
          // 查询任务状态
          const response = await fetch(`${APIMART_TASK_STATUS_API}?task_id=${encodeURIComponent(taskId)}`);
          const result = await response.json();

          if (result.code === 0 && result.data) {
            const taskData = result.data;
            const taskStatus = taskData.status;

            const updateFields: Record<string, any> = {};

            if (taskStatus === 'succeeded' || taskStatus === 'completed') {
              updateFields[taskStatusField.id] = '已完成';
              completedCount++;

              // 从任务结果中提取图像 URL（Apimart 实际返回: data.result.images[0].url 为数组 ["https://..."]）
              const rawUrl =
                (Array.isArray(taskData.result?.images) && taskData.result.images[0]?.url) ||
                taskData.output?.image_url ||
                taskData.output?.url ||
                taskData.output?.data?.url ||
                (Array.isArray(taskData.output) && taskData.output[0]?.url) ||
                (Array.isArray(taskData.output?.images) && taskData.output.images[0]) ||
                taskData.result?.output?.url ||
                taskData.result?.url;
              const imageUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;

              if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http') && nanoImageField) {
                try {
                  // 通过代理下载图片（避免 CORS），得到 Blob 后转为 File，由飞书 SDK 上传并写入附件
                  const proxyUrl = `${PROXY_DOWNLOAD_API}?url=${encodeURIComponent(imageUrl)}`;
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 60000);
                  const imgResponse = await fetch(proxyUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);

                  if (imgResponse.ok) {
                    const blob = await imgResponse.blob();
                    const fileName = `nano_${taskId}.${blob.type?.includes('png') ? 'png' : 'jpg'}`;
                    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
                    const attachmentField = await table.getFieldById(nanoImageField.id);
                    await attachmentField.setValue(record.recordId, file);
                    console.log(`记录 ${record.recordId} Nano 图像附件已写入: ${fileName}`);
                  } else {
                    console.warn(`下载 Nano 图像失败: ${imgResponse.status} ${imageUrl}`);
                  }
                } catch (e: any) {
                  console.warn('保存图像附件失败:', e);
                  Toast.warning(`记录 ${record.recordId} 图像附件保存失败: ${e?.message || '未知错误'}`);
                }
              } else if (imageUrl && nanoImageField) {
                console.warn('Nano 图像 URL 格式无效或非 http:', imageUrl);
              }
            } else if (taskStatus === 'failed' || taskStatus === 'error') {
              updateFields[taskStatusField.id] = `失败: ${taskData.error || '未知错误'}`;
              failedCount++;
            } else {
              updateFields[taskStatusField.id] = taskStatus === 'processing' ? '生成中' : (taskStatus || '处理中');
              pendingCount++;
            }

            if (Object.keys(updateFields).length > 0 && taskStatusField) {
              await table.setRecord(record.recordId, { fields: updateFields });
            }
          }
        } catch (e: any) {
          console.error(`查询任务 ${taskId} 状态失败:`, e);
          failedCount++;
        }
      }

      setStatus(`更新完成！已完成: ${completedCount}, 处理中: ${pendingCount}, 失败: ${failedCount}`);
      Toast.success(`状态更新完成！已完成: ${completedCount}, 处理中: ${pendingCount}, 失败: ${failedCount}`);
    } catch (error: any) {
      console.error('更新状态失败:', error);
      Toast.error(`更新状态失败: ${error.message || '未知错误'}`);
      setStatus(`更新失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([
      bitable.base.getTableMetaList(),
    ]).then(([metaList]) => {
      setTableMetaList(metaList);
    });
  }, []);

  // 表列表加载后，默认选中名为「Nano图像生成」的数据表
  useEffect(() => {
    if (!Array.isArray(tableMetaList) || tableMetaList.length === 0) return;
    const defaultTable = tableMetaList.find((t) => t.name === DEFAULT_TABLE_NAME);
    if (!defaultTable) return;
    const timer = setTimeout(() => {
      if (formApi.current && !formApi.current.getValue('dataTable')) {
        formApi.current.setValue('dataTable', defaultTable.id);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [tableMetaList]);

  return (
    <div style={styles.container}>
      <Card 
        style={{ marginBottom: 16, borderRadius: 8 }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <IconImage style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong>Nano 图像生成</Text>
        </div>

        <Banner 
          type="info" 
          description="使用 Gemini-3-Pro-Image-preview (Nano) 模型生成高质量图像，支持 1K/2K/4K 分辨率"
          style={{ marginBottom: 16 }}
        />

        {/* 功能说明 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)', fontWeight: 500 }}>表格字段要求</Text>
          <div style={{ marginTop: 8 }}>
            <div>
              <span style={{ ...styles.fieldTag, ...styles.fieldTagPrimary }}>图像提示词</span>
              <Text size="small" type="tertiary">（必填）图像描述文本</Text>
            </div>
            <div style={{ marginTop: 4 }}>
              <span style={{ ...styles.fieldTag, ...styles.fieldTagSecondary }}>参考图</span>
              <span style={{ ...styles.fieldTag, ...styles.fieldTagSecondary }}>图片比例</span>
              <span style={{ ...styles.fieldTag, ...styles.fieldTagSecondary }}>分辨率</span>
              <Text size="small" type="tertiary">（可选）</Text>
            </div>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <div style={styles.stepItem}>• 支持比例: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9</div>
          <div style={styles.stepItem}>• 支持分辨率: 1K（默认）, 2K, 4K</div>
          <div style={styles.stepItem}>• 最多支持14张参考图片</div>
          <div style={styles.stepItem}>• 生成的图像链接有效期24小时，请及时保存</div>
        </div>

        <Form 
          labelPosition='top' 
          onSubmit={handleBatchGenerate} 
          getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}
        >
          <Form.Select 
            field='dataTable' 
            label='数据表'
            placeholder="选择包含图像提示词的数据表" 
            style={{ width: '100%' }}
          >
            {Array.isArray(tableMetaList) && tableMetaList.map(({ name, id }) => (
              <Form.Select.Option key={id} value={id}>{name}</Form.Select.Option>
            ))}
          </Form.Select>

          {loading && (
            <div style={styles.progressContainer}>
              <Progress percent={progress} showInfo style={{ marginBottom: 8 }} />
              <Text size="small" type="tertiary">{status}</Text>
            </div>
          )}

          <div style={styles.buttonGroup}>
            <Button 
              theme="solid" 
              htmlType="submit" 
              loading={loading}
              icon={<IconImage />}
              style={{ flex: 1, borderRadius: 4 }}
            >
              批量生成图像
            </Button>
            <Button 
              theme="light"
              onClick={handleUpdateStatus}
              loading={loading}
              icon={<IconRefresh />}
              style={{ flex: 1, borderRadius: 4 }}
            >
              更新生成状态
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
