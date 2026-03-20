'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Space, Progress, Card, Banner, Switch, Upload } from '@douyinfe/semi-ui';
import { IconSend, IconRefresh2, IconUpload } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { getFieldStringValue } from '../../../lib/fieldUtils';
import { TIKTOK_REFRESH_TOKEN_API, TIKTOK_PUBLISH_STATUS_API, TIKTOK_VIDEO_LIST_API, UPLOAD_TO_OSS_API, PUBLISH_VIDEO_API } from '../../../lib/constants';

const { Title, Text } = Typography;

export default function MaterialPublish() {
  const [materialTableMetaList, setMaterialTableMetaList] = useState<ITableMeta[]>();
  const [accountTableMetaList, setAccountTableMetaList] = useState<ITableMeta[]>();
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [scheduledAutoPublishEnabled, setScheduledAutoPublishEnabled] = useState(false);
  const [batchFiles, setBatchFiles] = useState<Array<{ uid: string; name: string; size: number; file: File; status: 'pending' | 'uploading' | 'success' | 'error'; error?: string }>>([]);
  const formApi = useRef<BaseFormApi>();

  const backupMaterialToDb = useCallback(async (payload: Record<string, any>) => {
    try {
      await fetch('/api/syncMaterial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // ignore: 备份失败不影响主流程
    }
  }, []);

  // 获取附件临时下载链接
  const getAttachmentTempUrls = async (table: any, field: any, recordId: string): Promise<Array<{ url: string; name: string; size: number }>> => {
    try {
      const attachmentField = await table.getFieldById(field.id);
      const attachments = await attachmentField.getValue(recordId);
      
      if (Array.isArray(attachments) && attachments.length > 0) {
        // 获取临时下载链接
        const tempUrls = await attachmentField.getAttachmentUrls(recordId);
        
        return attachments.map((att: any, index: number) => ({
          url: tempUrls[index] || att.url || att.token || '',
          name: att.name || 'unknown',
          size: att.size || 0
        })).filter((item: any) => item.url);
      }
      return [];
    } catch (e) {
      console.error('获取附件临时下载链接失败:', e);
      return [];
    }
  };

  // 上传文件到阿里云OSS
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
          folder: folder || 'tiktok-videos'
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

  // 处理批量上传选择的本地视频文件
  const handleBatchFileChange = (fileList: any) => {
    const newFiles = (fileList?.fileList || []).map((file: any) => ({
      uid: file.uid,
      name: file.name,
      size: file.size,
      file: file.fileInstance as File,
      status: 'pending' as const,
    }));
    setBatchFiles(newFiles);
  };

  // 将本地视频批量上传到素材库表的「视频附件」字段
  const handleBatchUploadToMaterial = async () => {
    const values = formApi.current?.getValues() || {};
    const materialTableId = values.materialTable;

    if (!materialTableId) {
      Toast.error('请先在上方选择「素材库表」');
      return;
    }

    if (!batchFiles.length) {
      Toast.warning('请先选择要上传的视频文件');
      return;
    }

    try {
      setLoading(true);
      setProgress(0);
      setStatus('开始批量上传视频到素材库...');

      const materialTable = await bitable.base.getTableById(materialTableId);
      let videoAttachmentField: any = null;

      // 查找「视频附件」字段
      try {
        const fieldList = await materialTable.getFieldList();
        for (const field of fieldList) {
          try {
            const name = await field.getName();
            if (name === '视频附件') {
              videoAttachmentField = field;
              break;
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      if (!videoAttachmentField) {
        try {
          videoAttachmentField = await materialTable.getFieldByName('视频附件');
        } catch {
          // ignore
        }
      }

      if (!videoAttachmentField) {
        Toast.error('素材库表中未找到「视频附件」字段，请先在表中创建该附件列');
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // 附件大小上限（保守按 50MB 处理，超过则直接提示并跳过）
      const MAX_FILE_SIZE = 50 * 1024 * 1024;

      for (let i = 0; i < batchFiles.length; i++) {
        const item = batchFiles[i];
        setProgress(Math.round(((i + 1) / batchFiles.length) * 100));
        setStatus(`正在上传视频 ${i + 1}/${batchFiles.length}: ${item.name}`);

        try {
          // 大小预检查，避免命中 SDK 的 file size 异常
          if (item.size > MAX_FILE_SIZE) {
            throw new Error(`文件过大（${(item.size / 1024 / 1024).toFixed(1)}MB），请确保单个文件不超过 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
          }

          // 1. 新建一条素材记录（先创建空记录）
          const newRecord = await materialTable.addRecord({ fields: {} });
          let recordId: string | undefined;
          if (typeof newRecord === 'string') {
            recordId = newRecord;
          } else if (newRecord && typeof newRecord === 'object' && 'recordId' in newRecord) {
            recordId = (newRecord as { recordId: string }).recordId;
          }

          if (!recordId) {
            throw new Error('创建素材记录失败，未获取到 recordId');
          }

          // 2. 使用多维表格官方接口上传文件并写入附件字段
          // 飞书 SDK 对文件名较敏感，用纯英文短名（v1.mp4）+ 从 Blob 构造新 File 避免引用问题
          const raw = item.file;
          const blob = raw instanceof Blob ? raw : new Blob([raw], { type: (raw as any)?.type || 'video/mp4' });
          const safeName = `v${i + 1}.mp4`;
          const uploadFile = new File([blob], safeName, { type: blob.type || 'video/mp4' });

          const tokens = await bitable.base.batchUploadFile([uploadFile]);
          if (!tokens || !tokens.length) {
            throw new Error('上传文件失败：未获取到附件 token');
          }

          const attachmentField = await materialTable.getFieldById(videoAttachmentField.id);
          const attachmentValue = [{
            name: safeName,
            size: uploadFile.size,
            type: uploadFile.type || 'video/mp4',
            token: tokens[0],
            timeStamp: Date.now(),
          }];

          await attachmentField.setValue(recordId, attachmentValue);

          setBatchFiles(prev =>
            prev.map(f =>
              f.uid === item.uid ? { ...f, status: 'success' } : f
            )
          );
          successCount++;
        } catch (e: any) {
          console.error(`上传视频 ${item.name} 失败:`, e);
          setBatchFiles(prev =>
            prev.map(f =>
              f.uid === item.uid ? { ...f, status: 'error', error: e?.message || '未知错误' } : f
            )
          );
          errorCount++;
        }
      }

      const msg = `批量上传完成：成功 ${successCount} 个，失败 ${errorCount} 个`;
      if (errorCount === 0) {
        Toast.success(msg);
      } else {
        Toast.warning(msg);
      }
      setStatus(msg);
    } catch (error: any) {
      console.error('批量上传视频到素材库失败:', error);
      Toast.error(`批量上传失败: ${error?.message || '未知错误'}`);
      setStatus(`批量上传失败: ${error?.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // 获取发布状态（TikTok API 返回 data，其中 status 与 post_id 列表见技术文档 docs/tiktok）
  const getPublishStatus = async (accessToken: string, businessId: string, publishId: string): Promise<any> => {
    try {
      console.log(`正在获取发布状态 - publish_id: ${publishId}`);
      const response = await fetch(`${TIKTOK_PUBLISH_STATUS_API}?access_token=${encodeURIComponent(accessToken)}&business_id=${encodeURIComponent(businessId)}&publish_id=${encodeURIComponent(publishId)}`);

      const result = await response.json();

      if (result.code === 0 && result.data) {
        const data = result.data;
        console.log(`✅ 获取发布状态成功: ${data.status}`);
        // 兼容 API 字段：post_ids 或 publicaly_available_post_id（技术文档）
        const postIds = Array.isArray(data.post_ids)
          ? data.post_ids
          : Array.isArray(data.publicaly_available_post_id)
            ? data.publicaly_available_post_id
            : [];
        return { ...data, post_ids: postIds };
      } else {
        throw new Error(result.error || result.message || '获取发布状态失败');
      }
    } catch (error: any) {
      console.error('获取发布状态失败:', error);
      throw error;
    }
  };

  // 通过 video/list 获取 share_url，用于写入「TikTok视频链接」
  const getTikTokShareUrlByPostId = async (accessToken: string, businessId: string, postId: string): Promise<string | undefined> => {
    try {
      const fields = ['item_id', 'share_url'];
      const filters = { video_ids: [postId] };
      const apiUrl =
        `${TIKTOK_VIDEO_LIST_API}` +
        `?access_token=${encodeURIComponent(accessToken)}` +
        `&business_id=${encodeURIComponent(businessId)}` +
        `&fields=${encodeURIComponent(JSON.stringify(fields))}` +
        `&filters=${encodeURIComponent(JSON.stringify(filters))}` +
        `&max_count=20`;

      const resp = await fetch(apiUrl);
      const json = await resp.json();
      if (json?.code !== 0) return undefined;

      const videos: any[] = json?.data?.videos || [];
      const found = videos.find(v => String(v?.item_id) === String(postId));
      const shareUrl = found?.share_url ? String(found.share_url) : '';
      return shareUrl.trim() ? shareUrl.trim() : undefined;
    } catch (e) {
      console.warn('获取 TikTok share_url 失败:', e);
      return undefined;
    }
  };

  // 刷新Token
  const refreshToken = async (refreshTokenValue: string): Promise<any> => {
    try {
      console.log(`正在刷新Token...`);
      const response = await fetch(TIKTOK_REFRESH_TOKEN_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshTokenValue
        })
      });

      const result = await response.json();

      if (result.code === 0 && result.data) {
        console.log(`✅ Token刷新成功`);
        return result.data;
      } else {
        throw new Error(result.error || result.message || '刷新Token失败');
      }
    } catch (error: any) {
      console.error('刷新Token失败:', error);
      throw error;
    }
  };

  // 获取账号信息（包含Token刷新逻辑）
  const getAccountInfo = async (
    accountTable: any,
    accessTokenField: any,
    openIdField: any,
    openId: string,
    refreshTokenField?: any,
    tokenExpiresTimeField?: any
  ): Promise<any> => {
    try {
      console.log(`查找账号信息 - open_id: ${openId}`);
      
      // 获取所有账号记录
      const records = await accountTable.getRecords({ pageSize: 5000 });
      console.log(`账号列表中共有 ${records.records.length} 条记录`);
      
      // 查找匹配的open_id
      for (const record of records.records) {
        const recordOpenId = await getFieldStringValue(accountTable, openIdField, record.recordId);
        const recordOpenIdStr = recordOpenId ? String(recordOpenId).trim() : '';
        const targetOpenIdStr = String(openId).trim();
        
        console.log(`检查记录 ${record.recordId}: open_id = "${recordOpenIdStr}" (目标: "${targetOpenIdStr}")`);
        
        if (recordOpenIdStr === targetOpenIdStr) {
          // 找到匹配的账号，获取access_token
          let accessToken = await getFieldStringValue(accountTable, accessTokenField, record.recordId);
          let accessTokenStr = accessToken ? String(accessToken).trim() : '';
          
          console.log(`✅ 找到匹配账号 - recordId: ${record.recordId}, access_token: ${accessTokenStr ? accessTokenStr.substring(0, 30) + '...' : '(空)'}`);
          
          // 检查Token失效时间 - token失效时间字段为数字类型（时间戳毫秒）
          if (tokenExpiresTimeField) {
            try {
              // 直接获取数字类型的时间戳
              const expiresFieldValue = await tokenExpiresTimeField.getValue(record.recordId);
              const expiresTimestamp = typeof expiresFieldValue === 'number' ? expiresFieldValue : 
                                       (expiresFieldValue ? Number(expiresFieldValue) : 0);
              let shouldRefresh = false;
              const now = Date.now();

              if (expiresTimestamp > 0) {
                const timeUntilExpiry = expiresTimestamp - now;
                
                console.log(`Token失效时间检查: ${new Date(expiresTimestamp).toLocaleString()}, 剩余时间: ${Math.round(timeUntilExpiry / 1000 / 60)}分钟`);
                
                // 如果Token已失效或将在5分钟内失效，尝试刷新
                if (timeUntilExpiry < 5 * 60 * 1000) { // 5分钟缓冲时间
                  shouldRefresh = true;
                  console.log(`⚠️ Token即将失效或已失效，准备刷新...`);
                }
              } else {
                // 没有记录失效时间，视为需要刷新一次，确保后续有正确的 token失效时间
                shouldRefresh = true;
                console.log('⚠️ 账号记录中没有 token失效时间，将尝试刷新Token并补全该字段');
              }

              if (shouldRefresh) {
                if (refreshTokenField) {
                  const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, record.recordId);
                  if (refreshTokenValue) {
                    try {
                      const newTokenData = await refreshToken(String(refreshTokenValue).trim());
                      
                      // 更新账号列表中的token信息
                      const updateFields: Record<string, any> = {};
                      updateFields[accessTokenField.id] = newTokenData.access_token;
                      
                      if (refreshTokenField && newTokenData.refresh_token) {
                        updateFields[refreshTokenField.id] = newTokenData.refresh_token;
                      }
                      
                      // 计算新的失效时间（expires_in是秒数）- 直接使用时间戳（毫秒）
                      if (tokenExpiresTimeField && newTokenData.expires_in) {
                        const newExpiresTimestamp = now + newTokenData.expires_in * 1000;
                        updateFields[tokenExpiresTimeField.id] = newExpiresTimestamp;
                        console.log(`新的Token失效时间: ${new Date(newExpiresTimestamp).toLocaleString()} (时间戳: ${newExpiresTimestamp})`);
                      }
                      
                      // 更新记录
                      await accountTable.setRecord(record.recordId, { fields: updateFields });
                      console.log(`✅ 已更新账号列表中的Token信息`);
                      
                      // 使用新的access_token
                      accessTokenStr = newTokenData.access_token;
                      Toast.success(`Token已自动刷新并更新到账号列表`);
                    } catch (refreshError: any) {
                      console.error(`❌ Token刷新失败:`, refreshError);
                      Toast.warning(`Token刷新失败: ${refreshError.message || '未知错误'}，请手动更新Token`);
                    }
                  } else {
                    console.warn(`⚠️ 未找到refresh_token，无法刷新Token`);
                  }
                } else {
                  console.warn(`⚠️ 账号列表中未找到refresh_token字段，无法自动刷新Token`);
                }
              }
            } catch (e) {
              console.warn(`检查Token失效时间失败:`, e);
            }
          }
          
          if (!accessTokenStr) {
            console.warn(`⚠️ 账号 ${record.recordId} 的 access_token 为空`);
          } else if (accessTokenStr.length < 10) {
            console.warn(`⚠️ 账号 ${record.recordId} 的 access_token 格式可能不正确 (长度: ${accessTokenStr.length})`);
          }

          // 尝试从账号表获取用户名（用于拼 TikTok 视频链接）
          let username: string | undefined;
          try {
            const accountFieldList = await accountTable.getFieldList();
            for (const f of accountFieldList) {
              const name = await f.getName();
              if (name === 'username' || name === '用户名') {
                const v = await getFieldStringValue(accountTable, f, record.recordId);
                if (v && String(v).trim()) username = String(v).trim();
                break;
              }
            }
          } catch (e) {
            console.warn('获取账号用户名失败:', e);
          }
          
          return {
            recordId: record.recordId,
            openId: openId,
            accessToken: accessTokenStr,
            username
          };
        }
      }
      
      console.warn(`❌ 未找到匹配的账号 - open_id: ${openId}`);
      return null;
    } catch (e) {
      console.error('获取账号信息失败:', e);
      return null;
    }
  };

  // 自动发布
  const handleAutoPublish = useCallback(async ({ 
    materialTable: materialTableId,
    accountTable: accountTableId
  }: { 
    materialTable: string;
    accountTable: string;
  }) => {
    if (!materialTableId) {
      Toast.error('请先选择素材库表');
      return;
    }

    if (!accountTableId) {
      Toast.error('请先选择账号列表');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始查询待发布素材...');

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    try {
      // 获取素材库表和账号列表表
      const materialTable = await bitable.base.getTableById(materialTableId);
      const accountTable = await bitable.base.getTableById(accountTableId);

      // 获取素材库字段
      let materialFieldList = await materialTable.getFieldList();
      
      // 查找必需字段（通过名称获取）
      let publishStatusField: any = null;
      let publishTimeField: any = null;
      let publishAccountField: any = null;
      let videoAttachmentField: any = null;

      // 遍历字段列表，通过 getName() 获取字段名称并匹配
      for (const field of materialFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === '发布状态') {
            publishStatusField = field;
          } else if (fieldName === '发布时间') {
            publishTimeField = field;
          } else if (fieldName === '发布账号') {
            publishAccountField = field;
          } else if (fieldName === '视频附件') {
            videoAttachmentField = field;
          }
        } catch (e) {
          console.warn('获取字段名称失败:', e);
        }
      }

      // 如果字段不存在，尝试通过名称获取
      if (!publishStatusField) {
        try {
          publishStatusField = await materialTable.getFieldByName('发布状态');
        } catch (e) {
          console.warn('发布状态字段不存在');
        }
      }

      if (!publishTimeField) {
        try {
          publishTimeField = await materialTable.getFieldByName('发布时间');
        } catch (e) {
          console.warn('发布时间字段不存在');
        }
      }

      if (!publishAccountField) {
        try {
          publishAccountField = await materialTable.getFieldByName('发布账号');
        } catch (e) {
          console.warn('发布账号字段不存在');
        }
      }

      if (!videoAttachmentField) {
        try {
          videoAttachmentField = await materialTable.getFieldByName('视频附件');
        } catch (e) {
          console.warn('视频附件字段不存在');
        }
      }

      // 验证必需字段
      if (!publishStatusField) {
        Toast.error('素材库表中未找到"发布状态"字段');
        setLoading(false);
        return;
      }

      if (!publishTimeField) {
        Toast.error('素材库表中未找到"发布时间"字段');
        setLoading(false);
        return;
      }

      if (!publishAccountField) {
        Toast.error('素材库表中未找到"发布账号"字段');
        setLoading(false);
        return;
      }

      if (!videoAttachmentField) {
        Toast.error('素材库表中未找到"视频附件"字段');
        setLoading(false);
        return;
      }

      // 获取账号列表字段
      let accountFieldList = await accountTable.getFieldList();
      let accessTokenField: any = null;
      let openIdField: any = null;
      let refreshTokenField: any = null;
      let tokenExpiresTimeField: any = null;

      // 遍历字段列表，通过 getName() 获取字段名称并匹配
      for (const field of accountFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === 'access_token') {
            accessTokenField = field;
          } else if (fieldName === 'open_id') {
            openIdField = field;
          } else if (fieldName === 'refresh_token' || fieldName === '刷新令牌') {
            refreshTokenField = field;
          } else if (fieldName === 'token失效时间' || fieldName === 'token_expires_time' || fieldName === 'expires_time') {
            tokenExpiresTimeField = field;
          }
        } catch (e) {
          console.warn('获取字段名称失败:', e);
        }
      }

      if (!accessTokenField) {
        try {
          accessTokenField = await accountTable.getFieldByName('access_token');
        } catch (e) {
          console.warn('access_token字段不存在');
        }
      }

      if (!openIdField) {
        try {
          openIdField = await accountTable.getFieldByName('open_id');
        } catch (e) {
          console.warn('open_id字段不存在');
        }
      }
      
      if (!refreshTokenField) {
        try {
          refreshTokenField = await accountTable.getFieldByName('refresh_token');
        } catch (e) {
          console.warn('refresh_token字段不存在');
        }
      }
      
      if (!tokenExpiresTimeField) {
        try {
          tokenExpiresTimeField = await accountTable.getFieldByName('token失效时间');
        } catch (e) {
          console.warn('token失效时间字段不存在');
        }
      }

      if (!accessTokenField || !openIdField) {
        Toast.error('账号列表中未找到 access_token 或 open_id 字段');
        setLoading(false);
        return;
      }
      
      if (!refreshTokenField) {
        console.warn('⚠️ 账号列表中未找到 refresh_token 字段，将无法自动刷新Token');
      }
      
      if (!tokenExpiresTimeField) {
        console.warn('⚠️ 账号列表中未找到 token失效时间 字段，将无法判断Token是否失效');
      }

      // 获取所有素材记录
      setStatus('查询待发布素材...');
      const allRecords = await materialTable.getRecords({ pageSize: 5000 });
      const now = new Date();

      // 筛选符合条件的记录
      const pendingRecords: any[] = [];

      for (const record of allRecords.records) {
        try {
          // 检查发布状态
          const statusValue = await getFieldStringValue(materialTable, publishStatusField, record.recordId);
          if (!statusValue || String(statusValue).trim() !== '等待发布') {
            continue;
          }

          // 检查发布时间
          try {
            const publishTimeValue = await materialTable.getCellValue(publishTimeField.id, record.recordId);
            if (publishTimeValue) {
              let publishTime: Date | null = null;
              
              // 处理日期时间格式
              if (typeof publishTimeValue === 'number') {
                // Unix时间戳（毫秒）
                publishTime = new Date(publishTimeValue);
              } else if (typeof publishTimeValue === 'string') {
                // 字符串格式，尝试解析
                publishTime = new Date(publishTimeValue);
              } else if (publishTimeValue && typeof publishTimeValue === 'object') {
                // 可能是日期对象
                const timeObj = publishTimeValue as any;
                if (timeObj.timestamp) {
                  publishTime = new Date(timeObj.timestamp);
                } else {
                  publishTime = new Date(timeObj);
                }
              }

              if (publishTime && publishTime > now) {
                // 发布时间还未到，跳过
                continue;
              }
            }
          } catch (e) {
            console.warn(`获取发布时间失败 (记录 ${record.recordId}):`, e);
            // 如果无法获取发布时间，跳过该记录
            continue;
          }

          pendingRecords.push(record);
        } catch (e) {
          console.error(`检查记录 ${record.recordId} 失败:`, e);
        }
      }

      console.log(`找到 ${pendingRecords.length} 条待发布素材`);

      if (pendingRecords.length === 0) {
        Toast.info('没有符合条件的待发布素材');
        setLoading(false);
        return;
      }

      setStatus(`找到 ${pendingRecords.length} 条待发布素材，开始处理...`);

      // 处理每条记录
      for (let i = 0; i < pendingRecords.length; i++) {
        const record = pendingRecords[i];
        setProgress(Math.round(((i + 1) / pendingRecords.length) * 100));
        setStatus(`正在处理素材 ${i + 1}/${pendingRecords.length}...`);

        try {
          // 获取发布账号（open_id）
          const publishAccountValue = await getFieldStringValue(materialTable, publishAccountField, record.recordId);
          
          if (!publishAccountValue) {
            console.log(`记录 ${record.recordId} 没有发布账号，跳过`);
            skipCount++;
            continue;
          }

          const openId = String(publishAccountValue).trim();

          // 获取账号信息（包含Token刷新逻辑）
          const accountInfo = await getAccountInfo(
            accountTable,
            accessTokenField,
            openIdField,
            openId,
            refreshTokenField,
            tokenExpiresTimeField
          );

          if (!accountInfo || !accountInfo.accessToken) {
            console.log(`记录 ${record.recordId} 无法获取账号信息 (open_id: ${openId})，跳过`);
            Toast.warning(`素材 ${record.recordId} 无法获取账号信息，请检查账号列表中是否存在 open_id: ${openId}`);
            skipCount++;
            continue;
          }

          // 验证 access_token 格式（失败时可重试刷新）
          let accessToken = String(accountInfo.accessToken).trim();
          if (!accessToken || accessToken.length < 10) {
            console.error(`记录 ${record.recordId} 的 access_token 格式无效: ${accessToken.substring(0, 20)}...`);
            Toast.error(`素材 ${record.recordId} 的 access_token 格式无效，请更新账号信息`);
            errorCount++;
            continue;
          }

          console.log(`✅ 获取到账号信息 - open_id: ${openId}, access_token: ${accessToken.substring(0, 20)}...`);

          // 获取视频附件临时下载链接
          const videoAttachments = await getAttachmentTempUrls(materialTable, videoAttachmentField, record.recordId);
          
          if (videoAttachments.length === 0) {
            console.log(`记录 ${record.recordId} 没有视频附件，跳过`);
            skipCount++;
            continue;
          }

          // 获取其他字段信息
          let captionField: any = null;
          for (const field of materialFieldList) {
            try {
              const fieldName = await field.getName();
              if (fieldName === 'caption' || fieldName === '标题' || fieldName === 'title') {
                captionField = field;
                break;
              }
            } catch (e) {
              // 忽略
            }
          }
          
          if (!captionField) {
            // 先按新列名查找，再兼容旧列名
            try {
              captionField = await materialTable.getFieldByName('标题');
            } catch (e) {
              try {
                captionField = await materialTable.getFieldByName('caption');
              } catch (err) {
                // 忽略
              }
            }
          }

          let caption = '';
          if (captionField) {
            caption = await getFieldStringValue(materialTable, captionField, record.recordId) || '';
          }

          // 获取其他字段信息
          let videoUrlField: any = null;
          let customThumbnailUrlField: any = null;
          let isBrandOrganicField: any = null;
          let isBrandedContentField: any = null;
          let isAIGeneratedField: any = null;

          for (const field of materialFieldList) {
            try {
              const fieldName = await field.getName();
              if (fieldName === '视频链接' || fieldName === 'video_url') {
                videoUrlField = field;
              } else if (fieldName === '封面链接' || fieldName === 'custom_thumbnail_url') {
                customThumbnailUrlField = field;
              } else if (fieldName === 'is_brand_organic') {
                isBrandOrganicField = field;
              } else if (fieldName === 'is_branded_content') {
                isBrandedContentField = field;
              } else if (fieldName === '是否AI生成' || fieldName === 'AI生成' || fieldName === 'is_ai_generated') {
                isAIGeneratedField = field;
              }
            } catch (e) {
              // 忽略
            }
          }

          // 是否AI生成（布尔，默认 false）
          let isAIGenerated = false;
          if (isAIGeneratedField) {
            try {
              const aiValue = await getFieldStringValue(materialTable, isAIGeneratedField, record.recordId);
              if (aiValue) {
                const lower = String(aiValue).trim().toLowerCase();
                // 支持 是/yes/true/1
                isAIGenerated = lower === 'true' || lower === '是' || lower === 'yes' || lower === '1';
              }
            } catch (e) {
              console.warn(`获取是否AI生成字段失败:`, e);
            }
          }

          // 获取 视频链接/ video_url（如果已设置，优先使用；否则上传附件到OSS）
          let finalVideoUrl = '';
          if (videoUrlField) {
            const videoUrlValue = await getFieldStringValue(materialTable, videoUrlField, record.recordId);
            if (videoUrlValue) {
              finalVideoUrl = String(videoUrlValue).trim();
            }
          }
          
          // 如果没有设置 视频链接 / video_url，上传第一个附件到OSS
          if (!finalVideoUrl && videoAttachments.length > 0) {
            setStatus(`正在上传视频到OSS ${i + 1}/${pendingRecords.length}...`);
            try {
              const firstAttachment = videoAttachments[0];
              console.log(`开始上传视频到OSS: ${firstAttachment.name} (${firstAttachment.size} bytes)`);
              
              // 上传到OSS
              const ossUrl = await uploadToOSS(
                firstAttachment.url,
                firstAttachment.name,
                'tiktok-videos'
              );
              
              console.log(`✅ 视频上传到OSS成功: ${ossUrl}`);
              finalVideoUrl = ossUrl;
              
              // 更新视频链接字段
              if (videoUrlField) {
                try {
                  await materialTable.setCellValue(videoUrlField.id, record.recordId, ossUrl);
                  console.log(`✅ 已更新视频链接字段: ${ossUrl}`);
                } catch (updateError) {
                  console.warn(`更新视频链接字段失败:`, updateError);
                }
              } else {
                // 如果视频链接字段不存在，尝试创建
                try {
                  const newVideoUrlField = await materialTable.addField({
                    type: FieldType.Text,
                    name: '视频链接'
                  }) as any;
                  const fieldId = typeof newVideoUrlField === 'string' ? newVideoUrlField : newVideoUrlField.id;
                  await materialTable.setCellValue(fieldId, record.recordId, ossUrl);
                  console.log(`✅ 已创建并更新视频链接字段: ${ossUrl}`);
                  // 更新videoUrlField引用
                  if (typeof newVideoUrlField !== 'string') {
                    videoUrlField = newVideoUrlField;
                  }
                } catch (createError) {
                  console.warn(`创建视频链接字段失败:`, createError);
                }
              }
            } catch (uploadError: any) {
              console.error(`❌ 上传视频到OSS失败:`, uploadError);
              Toast.error(`上传视频到OSS失败: ${uploadError.message || '未知错误'}`);
              errorCount++;
              continue;
            }
          }

          if (!finalVideoUrl) {
            console.log(`记录 ${record.recordId} 没有有效的视频URL，跳过`);
            skipCount++;
            continue;
          }

          // 获取 封面链接 / custom_thumbnail_url
          let customThumbnailUrl = '';
          if (customThumbnailUrlField) {
            const thumbnailUrlValue = await getFieldStringValue(materialTable, customThumbnailUrlField, record.recordId);
            if (thumbnailUrlValue) {
              customThumbnailUrl = String(thumbnailUrlValue).trim();
            }
          }

          // 获取 is_brand_organic（单选字段）
          let isBrandOrganic = false;
          if (isBrandOrganicField) {
            try {
              const singleSelectField = await materialTable.getFieldById(isBrandOrganicField.id);
              const brandOrganicValue = await singleSelectField.getValue(record.recordId);
              if (brandOrganicValue) {
                // 单选字段返回 {id, text} 对象
                const textValue = typeof brandOrganicValue === 'object' ? brandOrganicValue.text : brandOrganicValue;
                isBrandOrganic = String(textValue).toLowerCase() === 'true';
              }
            } catch (e) {
              // 降级：使用字符串方式获取
              const brandOrganicValue = await getFieldStringValue(materialTable, isBrandOrganicField, record.recordId);
              if (brandOrganicValue) {
                isBrandOrganic = String(brandOrganicValue).toLowerCase() === 'true';
              }
            }
          }

          // 获取 is_branded_content（单选字段）
          let isBrandedContent = false;
          if (isBrandedContentField) {
            try {
              const singleSelectField = await materialTable.getFieldById(isBrandedContentField.id);
              const brandedContentValue = await singleSelectField.getValue(record.recordId);
              if (brandedContentValue) {
                // 单选字段返回 {id, text} 对象
                const textValue = typeof brandedContentValue === 'object' ? brandedContentValue.text : brandedContentValue;
                isBrandedContent = String(textValue).toLowerCase() === 'true';
              }
            } catch (e) {
              // 降级：使用字符串方式获取
              const brandedContentValue = await getFieldStringValue(materialTable, isBrandedContentField, record.recordId);
              if (brandedContentValue) {
                isBrandedContent = String(brandedContentValue).toLowerCase() === 'true';
              }
            }
          }

          // 准备发布数据
          const publishData = {
            access_token: accessToken, // 使用验证过的 accessToken
            business_id: openId,
            video_url: finalVideoUrl,
            custom_thumbnail_url: customThumbnailUrl || undefined,
            post_info: {
              caption: caption || '',
              is_brand_organic: isBrandOrganic,
              is_branded_content: isBrandedContent,
              is_ai_generated: isAIGenerated,
              disable_comment: false,
              disable_duet: false,
              disable_stitch: false
            }
          };

          console.log(`准备发布素材 ${record.recordId}:`, {
            ...publishData,
            access_token: '***'
          });
          
          // 详细日志（仅用于调试）
          console.log(`发布参数详情:`, {
            recordId: record.recordId,
            openId: openId,
            accessTokenLength: accessToken.length,
            accessTokenPrefix: accessToken.substring(0, 30) + '...',
            videoUrl: finalVideoUrl,
            caption: caption?.substring(0, 50) + '...'
          });

          // 调用发布API（如果 token 过期/无效，自动刷新并重试一次）
          try {
            const tryPublish = async (token: string) => {
              const payload = { ...publishData, access_token: token };
              console.log(`正在调用发布API...`);
              const publishResponse = await fetch(PUBLISH_VIDEO_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });
              console.log(`发布API响应状态: ${publishResponse.status} ${publishResponse.statusText}`);

              const publishResult = await publishResponse.json();
              console.log(`发布API返回结果:`, {
                code: publishResult.code,
                message: publishResult.message,
                error: publishResult.error,
                error_code: publishResult.error_code,
              });
              return publishResult;
            };

            const isTokenError = (result: any) => {
              const msg = String(result?.message || result?.error || '');
              const errorCode = result?.error_code ?? result?.code;
              return (
                msg.toLowerCase().includes('access token') ||
                msg.toLowerCase().includes('token') ||
                msg.toLowerCase().includes('revoked') ||
                msg.toLowerCase().includes('expired') ||
                errorCode === 40101 ||
                errorCode === 40102
              );
            };

            let publishResult = await tryPublish(accessToken);

            // token 无效兜底：refresh_token 刷新后重试一次
            if (publishResult?.code !== 0 && isTokenError(publishResult) && refreshTokenField && accountInfo?.recordId) {
              try {
                const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, accountInfo.recordId);
                if (refreshTokenValue) {
                  const newTokenData = await refreshToken(String(refreshTokenValue).trim());

                  const updateFields: Record<string, any> = {};
                  updateFields[accessTokenField.id] = newTokenData.access_token;

                  if (refreshTokenField && newTokenData.refresh_token) {
                    updateFields[refreshTokenField.id] = newTokenData.refresh_token;
                  }

                  if (tokenExpiresTimeField && newTokenData.expires_in) {
                    const nowTs = Date.now();
                    updateFields[tokenExpiresTimeField.id] = nowTs + newTokenData.expires_in * 1000;
                  }

                  await accountTable.setRecord(accountInfo.recordId, { fields: updateFields });
                  accessToken = String(newTokenData.access_token).trim();
                  publishResult = await tryPublish(accessToken);
                }
              } catch (refreshErr: any) {
                console.warn(`⚠️ token 刷新后重试发布失败:`, refreshErr);
              }
            }

            if (publishResult.code === 0 && publishResult.data) {
              // 发布成功
              const shareId = publishResult.data.share_id;
              console.log(`✅ 素材 ${record.recordId} 发布成功，share_id: ${shareId}`);

              // 更新发布状态为"发布中"或"已发布"
              try {
                const statusField = publishStatusField;
                if (statusField) {
                  try {
                    // 获取单选字段对象
                    const singleSelectField = await materialTable.getFieldById(statusField.id);
                    // 尝试更新状态为"发布中"
                    try {
                      await singleSelectField.setValue(record.recordId, '发布中');
                    } catch (e) {
                      // 如果"发布中"选项不存在，尝试设置为"已发布"
                      try {
                        await singleSelectField.setValue(record.recordId, '已发布');
                      } catch (e2) {
                        console.warn(`更新发布状态失败:`, e2);
                      }
                    }
                  } catch (e) {
                    console.warn(`获取状态字段失败:`, e);
                  }
                }

                // 如果有 share_id 字段，保存 share_id
                let shareIdField: any = null;
                for (const field of materialFieldList) {
                  try {
                    const fieldName = await field.getName();
                    if (fieldName === 'share_id' || fieldName === 'publish_id') {
                      shareIdField = field;
                      break;
                    }
                  } catch (e) {
                    // 忽略
                  }
                }

                if (shareIdField) {
                  try {
                    await materialTable.setCellValue(shareIdField.id, record.recordId, shareId);
                    console.log(`✅ 已保存 share_id: ${shareId}`);
                  } catch (e) {
                    console.warn(`保存 share_id 失败:`, e);
                  }
                }

                // 备份到 MySQL（不阻塞主流程）
                backupMaterialToDb({
                  recordId: record.recordId,
                  caption: caption || '',
                  videoUrl: finalVideoUrl,
                  customThumbnailUrl: customThumbnailUrl || undefined,
                  publishStatus: '发布中',
                  publishAccount: openId,
                  shareId: shareId,
                  isBrandOrganic,
                  isBrandedContent,
                  isAiGenerated: isAIGenerated,
                });

                // 获取发布状态并更新
                try {
                  setStatus(`正在获取素材 ${i + 1}/${pendingRecords.length} 的发布状态...`);
                  const publishStatusData = await getPublishStatus(accessToken, openId, shareId);
                  
                  if (publishStatusData && publishStatusData.status) {
                    const statusValue = publishStatusData.status;
                    console.log(`发布状态: ${statusValue}`);
                    
                    // 映射状态到中文
                    let statusText = '发布中';
                    if (statusValue === 'PUBLISH_COMPLETE') {
                      statusText = '已发布';
                    } else if (statusValue === 'FAILED') {
                      statusText = '发布失败';
                      const reason = publishStatusData.reason || '未知原因';
                      console.error(`发布失败原因: ${reason}`);
                      Toast.warning(`素材 ${record.recordId} 发布失败: ${reason}`);
                    } else if (statusValue === 'PROCESSING_DOWNLOAD' || statusValue === 'SEND_TO_USER_INBOX') {
                      statusText = '发布中';
                    }
                    
                    // 更新发布状态字段
                    if (publishStatusField) {
                      try {
                        const singleSelectField = await materialTable.getFieldById(publishStatusField.id);
                        await singleSelectField.setValue(record.recordId, statusText);
                        console.log(`✅ 已更新发布状态为: ${statusText}`);
                      } catch (e) {
                        console.warn(`更新发布状态失败:`, e);
                      }
                    }

                    // 备份到 MySQL（不阻塞主流程）
                    backupMaterialToDb({
                      recordId: record.recordId,
                      publishStatus: statusText,
                      publishAccount: openId,
                      shareId,
                    });
                    
                    // 如果发布成功，保存post_ids和TikTok视频链接（如果有）
                    if (statusValue === 'PUBLISH_COMPLETE' && publishStatusData.post_ids && Array.isArray(publishStatusData.post_ids) && publishStatusData.post_ids.length > 0) {
                      // 查找或创建post_ids字段
                      let postIdsField: any = null;
                      for (const field of materialFieldList) {
                        try {
                          const fieldName = await field.getName();
                          if (fieldName === 'post_ids' || fieldName === 'post_id') {
                            postIdsField = field;
                            break;
                          }
                        } catch (e) {
                          // 忽略
                        }
                      }

                      if (postIdsField) {
                        try {
                          const postIdsValue = publishStatusData.post_ids.join(',');
                          await materialTable.setCellValue(postIdsField.id, record.recordId, postIdsValue);
                          console.log(`✅ 已保存 post_ids: ${postIdsValue}`);

                          // 备份到 MySQL（不阻塞主流程）
                          backupMaterialToDb({
                            recordId: record.recordId,
                            publishStatus: '已发布',
                            publishAccount: openId,
                            shareId,
                            postIds: postIdsValue,
                          });
                        } catch (e) {
                          console.warn(`保存 post_ids 失败:`, e);
                        }
                      }

                      // 构建并保存TikTok视频链接（使用账号表中的用户名）
                      const firstPostId = publishStatusData.post_ids[0];
                      const shareUrl = await getTikTokShareUrlByPostId(accessToken, openId, firstPostId);
                      const username = (accountInfo?.username && String(accountInfo.username).trim()) || 'user';
                      const tiktokVideoUrl = shareUrl || `https://www.tiktok.com/@${username}/video/${firstPostId}`;

                      // 查找或创建TikTok视频链接字段
                      let tiktokLinkField: any = null;
                      for (const field of materialFieldList) {
                        try {
                          const fieldName = await field.getName();
                          if (fieldName === 'TikTok视频链接' || fieldName === 'tiktok_video_url' || fieldName === 'tiktok_link') {
                            tiktokLinkField = field;
                            break;
                          }
                        } catch (e) {
                          // 忽略
                        }
                      }

                      if (!tiktokLinkField) {
                        // 尝试通过名称获取
                        try {
                          tiktokLinkField = await materialTable.getFieldByName('TikTok视频链接');
                        } catch (e) {
                          // 字段不存在，尝试创建
                          try {
                            const newField = await materialTable.addField({
                              type: FieldType.Text,
                              name: 'TikTok视频链接'
                            }) as any;
                            const fieldId = typeof newField === 'string' ? newField : newField.id;
                            tiktokLinkField = typeof newField === 'string' ? null : newField;
                            console.log(`✅ 已创建 TikTok视频链接 字段`);
                          } catch (createError) {
                            console.warn(`创建 TikTok视频链接 字段失败:`, createError);
                          }
                        }
                      }

                      if (tiktokLinkField) {
                        try {
                          await materialTable.setCellValue(tiktokLinkField.id, record.recordId, tiktokVideoUrl);
                          console.log(`✅ 已保存 TikTok视频链接: ${tiktokVideoUrl}`);

                          // 备份到 MySQL（不阻塞主流程）
                          backupMaterialToDb({
                            recordId: record.recordId,
                            publishStatus: '已发布',
                            publishAccount: openId,
                            shareId,
                            postIds: Array.isArray(publishStatusData.post_ids) ? publishStatusData.post_ids.join(',') : undefined,
                            tiktokVideoUrl,
                          });
                        } catch (e) {
                          console.warn(`保存 TikTok视频链接 失败:`, e);
                        }
                      }
                    }
                  }
                } catch (statusError: any) {
                  console.warn(`获取发布状态失败:`, statusError);
                  // 即使获取状态失败，也不影响发布成功的记录
                }
              } catch (e) {
                console.warn(`更新记录状态失败:`, e);
              }

              processedCount++;
              successCount++;
            } else {
              // 发布失败
              const errorMsg = publishResult.message || publishResult.error || '发布失败';
              const errorCode = publishResult.error_code || publishResult.code;
              
              console.error(`❌ 素材 ${record.recordId} 发布失败:`, errorMsg);
              
              // 检查是否是 token 相关错误
              const isTokenError = errorMsg.toLowerCase().includes('access token') || 
                                   errorMsg.toLowerCase().includes('token') ||
                                   errorMsg.toLowerCase().includes('revoked') ||
                                   errorMsg.toLowerCase().includes('expired') ||
                                   errorCode === 40101 || // TikTok API token 错误码
                                   errorCode === 40102;
              
              if (isTokenError) {
                console.error(`⚠️ Access Token 已过期或无效，请更新账号列表中的 access_token`);
                Toast.warning({
                  content: `素材 ${record.recordId} 发布失败：Access Token 已过期或无效，请前往"账号管理"页面更新该账号的 access_token`,
                  duration: 5000
                });
              } else {
                Toast.error(`素材 ${record.recordId} 发布失败: ${errorMsg}`);
              }
              
              // 更新发布状态为"发布失败"
              try {
                const statusField = publishStatusField;
                if (statusField) {
                  try {
                    const singleSelectField = await materialTable.getFieldById(statusField.id);
                    await singleSelectField.setValue(record.recordId, '发布失败');
                  } catch (e) {
                    console.warn(`更新发布状态失败:`, e);
                  }
                }
              } catch (e) {
                console.warn(`更新记录状态失败:`, e);
              }

              errorCount++;
            }
          } catch (error: any) {
            console.error(`发布素材 ${record.recordId} 时出错:`, error);
            errorCount++;
          }

        } catch (error: any) {
          console.error(`处理素材 ${record.recordId} 失败:`, error);
          errorCount++;
        }
      }

      // 显示最终结果
      const message = `处理完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`;
      if (errorCount === 0) {
        Toast.success(message);
      } else {
        Toast.warning(message);
      }
      setStatus(message);

    } catch (error: any) {
      console.error('自动发布失败:', error);
      Toast.error(`发布失败: ${error.message || '未知错误'}`);
      setStatus(`发布失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 批量更新发布状态
  const handleUpdatePublishStatus = useCallback(async () => {
    const formValues = formApi.current?.getValues();
    const materialTableId = formValues?.materialTable;
    const accountTableId = formValues?.accountTable;

    if (!materialTableId) {
      Toast.error('请先选择素材库表');
      return;
    }

    if (!accountTableId) {
      Toast.error('请先选择账号列表');
      return;
    }

    setUpdatingStatus(true);
    setProgress(0);
    setStatus('开始查询发布中的素材...');

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    try {
      const materialTable = await bitable.base.getTableById(materialTableId);
      const accountTable = await bitable.base.getTableById(accountTableId);

      // 获取字段列表
      let materialFieldList = await materialTable.getFieldList();
      let accountFieldList = await accountTable.getFieldList();

      // 查找必需字段
      let publishStatusField: any = null;
      let publishAccountField: any = null;
      let shareIdField: any = null;
      let postIdsField: any = null;

      for (const field of materialFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === '发布状态') {
            publishStatusField = field;
          } else if (fieldName === '发布账号') {
            publishAccountField = field;
          } else if (fieldName === 'share_id' || fieldName === 'publish_id') {
            shareIdField = field;
          } else if (fieldName === 'post_ids' || fieldName === 'post_id') {
            postIdsField = field;
          }
        } catch (e) {
          // 忽略
        }
      }

      if (!publishStatusField) {
        Toast.error('素材库表中未找到"发布状态"字段');
        setUpdatingStatus(false);
        return;
      }

      if (!shareIdField) {
        Toast.error('素材库表中未找到"share_id"或"publish_id"字段');
        setUpdatingStatus(false);
        return;
      }

      // 查找账号列表字段
      let accessTokenField: any = null;
      let openIdField: any = null;

      for (const field of accountFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === 'access_token') {
            accessTokenField = field;
          } else if (fieldName === 'open_id') {
            openIdField = field;
          }
        } catch (e) {
          // 忽略
        }
      }

      if (!accessTokenField || !openIdField) {
        Toast.error('账号列表中未找到 access_token 或 open_id 字段');
        setUpdatingStatus(false);
        return;
      }

      // 查询所有"发布中"状态的记录
      setStatus('查询发布中的素材...');
      const allRecords = await materialTable.getRecords({ pageSize: 5000 });
      const publishingRecords = [];

      for (const record of allRecords.records) {
        const statusValue = await getFieldStringValue(materialTable, publishStatusField, record.recordId);
        if (statusValue === '发布中') {
          const shareId = await getFieldStringValue(materialTable, shareIdField, record.recordId);
          if (shareId) {
            publishingRecords.push({ record, shareId });
          } else {
            console.log(`记录 ${record.recordId} 没有 share_id，跳过`);
            skipCount++;
          }
        }
      }

      console.log(`找到 ${publishingRecords.length} 条发布中的素材`);

      if (publishingRecords.length === 0) {
        Toast.info('没有找到发布中的素材');
        setUpdatingStatus(false);
        return;
      }

      setStatus(`找到 ${publishingRecords.length} 条发布中的素材，开始更新状态...`);

      // 处理每条记录
      for (let i = 0; i < publishingRecords.length; i++) {
        const { record, shareId } = publishingRecords[i];
        setProgress(Math.round(((i + 1) / publishingRecords.length) * 100));
        setStatus(`正在更新素材 ${i + 1}/${publishingRecords.length} 的发布状态...`);

        try {
          // 获取发布账号（open_id）
          let openId: string | null = null;
          if (publishAccountField) {
            // 先尝试使用 getFieldStringValue（适用于文本字段或直接存储 open_id 的情况）
            const publishAccountValue = await getFieldStringValue(materialTable, publishAccountField, record.recordId);
            
            if (publishAccountValue) {
              // 如果获取到值，直接使用（可能是 open_id 字符串）
              openId = String(publishAccountValue).trim();
              console.log(`从发布账号字段获取到 open_id: ${openId}`);
            } else {
              // 如果 getFieldStringValue 返回空，尝试作为关联字段处理
              try {
                const publishAccountCellValue = await materialTable.getCellValue(publishAccountField.id, record.recordId);
                if (Array.isArray(publishAccountCellValue) && publishAccountCellValue.length > 0) {
                  // 关联字段：从关联记录中获取 open_id
                  const linkedRecord = publishAccountCellValue[0] as any;
                  const linkedRecordId = linkedRecord.recordIds?.[0];
                  if (linkedRecordId) {
                    openId = await getFieldStringValue(accountTable, openIdField, linkedRecordId);
                    console.log(`从关联记录获取到 open_id: ${openId}`);
                  }
                } else if (typeof publishAccountCellValue === 'string' && publishAccountCellValue.trim()) {
                  openId = publishAccountCellValue.trim();
                  console.log(`从关联字段值获取到 open_id: ${openId}`);
                }
              } catch (e) {
                console.warn(`获取发布账号字段值失败:`, e);
              }
            }
          }

          if (!openId) {
            console.log(`记录 ${record.recordId} 没有有效的发布账号 open_id，跳过`);
            skipCount++;
            continue;
          }

          // 获取账号信息（包含access_token）
          const accountInfo = await getAccountInfo(
            accountTable,
            accessTokenField,
            openIdField,
            openId,
            null, // refreshTokenField - 更新状态时不需要刷新token
            null  // tokenExpiresTimeField
          );

          if (!accountInfo || !accountInfo.accessToken) {
            console.log(`记录 ${record.recordId} 无法获取账号信息 (open_id: ${openId})，跳过`);
            skipCount++;
            continue;
          }

          // 获取发布状态
          const publishStatusData = await getPublishStatus(accountInfo.accessToken, openId, shareId);

          if (publishStatusData && publishStatusData.status) {
            const statusValue = publishStatusData.status;
            console.log(`素材 ${record.recordId} 发布状态: ${statusValue}`);

            // 映射状态到中文
            let statusText = '发布中';
            if (statusValue === 'PUBLISH_COMPLETE') {
              statusText = '已发布';
            } else if (statusValue === 'FAILED') {
              statusText = '发布失败';
              const reason = publishStatusData.reason || '未知原因';
              console.error(`发布失败原因: ${reason}`);
            } else if (statusValue === 'PROCESSING_DOWNLOAD' || statusValue === 'SEND_TO_USER_INBOX') {
              statusText = '发布中';
            }

            // 更新发布状态字段
            try {
              const singleSelectField = await materialTable.getFieldById(publishStatusField.id);
              await singleSelectField.setValue(record.recordId, statusText);
              console.log(`✅ 已更新发布状态为: ${statusText}`);
              processedCount++;
              successCount++;
            } catch (e) {
              console.warn(`更新发布状态失败:`, e);
              errorCount++;
            }

            // 如果发布成功，保存post_ids和TikTok视频链接（如果有）
            if (statusValue === 'PUBLISH_COMPLETE' && publishStatusData.post_ids && Array.isArray(publishStatusData.post_ids) && publishStatusData.post_ids.length > 0) {
              if (postIdsField) {
                try {
                  const postIdsValue = publishStatusData.post_ids.join(',');
                  await materialTable.setCellValue(postIdsField.id, record.recordId, postIdsValue);
                  console.log(`✅ 已保存 post_ids: ${postIdsValue}`);

                  // 备份到 MySQL（不阻塞主流程）
                  backupMaterialToDb({
                    recordId: record.recordId,
                    publishStatus: '已发布',
                    publishAccount: openId,
                    shareId,
                    postIds: postIdsValue,
                  });
                } catch (e) {
                  console.warn(`保存 post_ids 失败:`, e);
                }
              }

              // 构建并保存TikTok视频链接（使用账号表中的用户名）
              const firstPostId = publishStatusData.post_ids[0];
              const shareUrl = await getTikTokShareUrlByPostId(String(accountInfo.accessToken).trim(), openId, firstPostId);
              const username = (accountInfo?.username && String(accountInfo.username).trim()) || 'user';
              const tiktokVideoUrl = shareUrl || `https://www.tiktok.com/@${username}/video/${firstPostId}`;

              // 查找或创建TikTok视频链接字段
              let tiktokLinkField: any = null;
              for (const field of materialFieldList) {
                try {
                  const fieldName = await field.getName();
                  if (fieldName === 'TikTok视频链接' || fieldName === 'tiktok_video_url' || fieldName === 'tiktok_link') {
                    tiktokLinkField = field;
                    break;
                  }
                } catch (e) {
                  // 忽略
                }
              }

              if (!tiktokLinkField) {
                // 尝试通过名称获取
                try {
                  tiktokLinkField = await materialTable.getFieldByName('TikTok视频链接');
                } catch (e) {
                  // 字段不存在，尝试创建
                  try {
                    const newField = await materialTable.addField({
                      type: FieldType.Text,
                      name: 'TikTok视频链接'
                    }) as any;
                    const fieldId = typeof newField === 'string' ? newField : newField.id;
                    tiktokLinkField = typeof newField === 'string' ? null : newField;
                    console.log(`✅ 已创建 TikTok视频链接 字段`);
                  } catch (createError) {
                    console.warn(`创建 TikTok视频链接 字段失败:`, createError);
                  }
                }
              }

              if (tiktokLinkField) {
                try {
                  await materialTable.setCellValue(tiktokLinkField.id, record.recordId, tiktokVideoUrl);
                  console.log(`✅ 已保存 TikTok视频链接: ${tiktokVideoUrl}`);

                  // 备份到 MySQL（不阻塞主流程）
                  backupMaterialToDb({
                    recordId: record.recordId,
                    publishStatus: '已发布',
                    publishAccount: openId,
                    shareId,
                    postIds: Array.isArray(publishStatusData.post_ids) ? publishStatusData.post_ids.join(',') : undefined,
                    tiktokVideoUrl,
                  });
                } catch (e) {
                  console.warn(`保存 TikTok视频链接 失败:`, e);
                }
              }
            }
          } else {
            console.warn(`记录 ${record.recordId} 获取发布状态失败`);
            errorCount++;
          }
        } catch (error: any) {
          console.error(`更新素材 ${record.recordId} 发布状态失败:`, error);
          errorCount++;
        }
      }

      // 显示最终结果
      const message = `更新完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`;
      if (errorCount === 0) {
        Toast.success(message);
      } else {
        Toast.warning(message);
      }
      setStatus(message);

    } catch (error: any) {
      console.error('更新发布状态失败:', error);
      Toast.error(`更新失败: ${error.message || '未知错误'}`);
      setStatus(`更新失败: ${error.message || '未知错误'}`);
    } finally {
      setUpdatingStatus(false);
      setProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([
      bitable.base.getTableMetaList(),
      bitable.base.getSelection()
    ]).then(([metaList, selection]) => {
      setMaterialTableMetaList(metaList);
      setAccountTableMetaList(metaList);
      
      // 根据表名查找并默认选中
      const materialTableId = metaList.find(table => table.name === '素材库')?.id || selection.tableId;
      const accountTableId = metaList.find(table => table.name === '账号列表')?.id || selection.tableId;
      
      formApi.current?.setValues({ 
        materialTable: materialTableId,
        accountTable: accountTableId 
      });
    });
  }, []);

  // 定时自动发布：开启后每隔一段时间检查并发布已到期的素材（需保持本页或边栏打开）
  const runScheduledPublish = useCallback(() => {
    if (loading || updatingStatus) return;
    const vals = formApi.current?.getValues();
    if (vals?.materialTable && vals?.accountTable) {
      handleAutoPublish({ materialTable: vals.materialTable, accountTable: vals.accountTable });
    }
  }, [loading, updatingStatus, handleAutoPublish]);

  useEffect(() => {
    if (!scheduledAutoPublishEnabled) return;
    const intervalMs = 10 * 60 * 1000; // 每 10 分钟
    const firstRunMs = 60 * 1000;       // 开启后 1 分钟首次检查
    const firstTimer = setTimeout(() => runScheduledPublish(), firstRunMs);
    const id = setInterval(runScheduledPublish, intervalMs);
    return () => {
      clearTimeout(firstTimer);
      clearInterval(id);
    };
  }, [scheduledAutoPublishEnabled, runScheduledPublish]);

  // 样式常量 - 遵循 Base 开放设计规范
  const styles = {
    container: { padding: '0 4px' },
    header: { marginBottom: 16 },
    card: { marginBottom: 16, borderRadius: 8 },
    cardBody: { padding: '16px 20px' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    infoCard: { backgroundColor: 'var(--semi-color-fill-0)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 },
    stepItem: { marginBottom: 4, color: 'var(--semi-color-text-2)', fontSize: 13, lineHeight: '20px' },
    buttonGroup: { display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' as const },
    progressContainer: { marginTop: 16, marginBottom: 8 },
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <Title heading={5} style={{ marginBottom: 4, color: 'var(--semi-color-text-0)' }}>
          素材发布
        </Title>
        <Text type="tertiary" size="small">
          自动化发布视频到 TikTok，支持定时发布
        </Text>
      </div>

      {/* 发布配置卡片 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <div style={styles.sectionTitle}>
          <IconSend style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>发布配置</Text>
        </div>

        {/* 功能说明 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)', fontWeight: 500 }}>发布条件</Text>
          <div style={{ marginTop: 8 }}>
            <div style={styles.stepItem}>发布状态 = &quot;等待发布&quot; 且 发布时间 ≤ 当前时间</div>
            <div style={styles.stepItem}>系统自动检查并刷新过期 Token</div>
            <div style={styles.stepItem}>自动上传视频到 OSS 并发布到 TikTok</div>
          </div>
        </div>

        <Form 
          labelPosition='top' 
          onSubmit={handleAutoPublish} 
          getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}
        >
          <Form.Select 
            field='materialTable' 
            label='素材库表'
            placeholder="选择包含发布信息的素材数据表" 
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择素材库表' }]}
            optionList={materialTableMetaList?.map(({ name, id }) => ({ label: name, value: id }))}
          />

          <Form.Select 
            field='accountTable' 
            label='账号列表'
            placeholder="选择包含 Token 的账号数据表" 
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择账号列表' }]}
            optionList={accountTableMetaList?.map(({ name, id }) => ({ label: name, value: id }))}
          />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Switch
              checked={scheduledAutoPublishEnabled}
              onChange={setScheduledAutoPublishEnabled}
              style={{ flexShrink: 0 }}
            />
            <Text size="small" type="tertiary" style={{ flex: '1 1 0', minWidth: 0, wordBreak: 'break-word' }}>
              定时自动发布：开启后每 10 分钟自动检查并发布已到期的素材（需保持本页面或边栏打开）
            </Text>
          </div>

          {/* 进度显示 */}
          {(loading || updatingStatus) && (
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
              htmlType='submit' 
              loading={loading}
              disabled={updatingStatus}
              icon={<IconSend />}
              className="btn-primary"
              style={{ flex: '1 1 80px', minWidth: 0 }}
            >
              自动发布
            </Button>
            <Button 
              onClick={handleUpdatePublishStatus}
              loading={updatingStatus}
              disabled={loading}
              icon={<IconRefresh2 />}
              className="btn-secondary"
              style={{ flex: '1 1 80px', minWidth: 0 }}
            >
              更新状态
            </Button>
          </div>
        </Form>
      </Card>

      {/* 批量上传到素材库 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <div style={styles.sectionTitle}>
          <IconUpload style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>批量上传到素材库</Text>
        </div>

        <Space vertical align="start" style={{ width: '100%' }}>
          <Text size="small" type="tertiary">
            从本地选择多个视频文件，系统会为每个视频在当前「素材库表」中创建一条新记录，并写入「视频附件」列，后续可配合自动发布使用。
          </Text>

          <Upload
            action=""
            accept="video/*"
            multiple
            beforeUpload={() => false}
            onChange={handleBatchFileChange}
            style={{ marginTop: 8 }}
          >
            <Button icon={<IconUpload />} theme="light">
              选择视频文件（可多选）
            </Button>
          </Upload>

          {batchFiles.length > 0 && (
            <Text size="small" type="tertiary">
              已选择 {batchFiles.length} 个视频文件
            </Text>
          )}

          <div style={styles.buttonGroup}>
            <Button
              onClick={handleBatchUploadToMaterial}
              loading={loading}
              disabled={loading || updatingStatus || batchFiles.length === 0}
              icon={<IconUpload />}
              className="btn-primary"
              style={{ flex: '1 1 80px', minWidth: 0 }}
            >
              批量上传到素材库
            </Button>
          </div>
        </Space>
      </Card>

      {/* 提示信息 */}
      <Banner 
        type="warning"
        description="发布前请确保素材已准备好视频附件和标题。发布操作会调用 TikTok API。"
        style={{ borderRadius: 8 }}
      />
    </div>
  );
}

