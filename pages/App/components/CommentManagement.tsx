'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Space, Progress, Card, Divider, Banner } from '@douyinfe/semi-ui';
import { IconComment, IconSend, IconRefresh } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { 
  TIKTOK_COMMENT_LIST_API, 
  TIKTOK_REFRESH_TOKEN_API,
  TIKTOK_COMMENT_CREATE_API,
  TIKTOK_COMMENT_REPLY_CREATE_API,
  TIKTOK_COMMENT_LIKE_API,
  TIKTOK_COMMENT_HIDE_API,
  TIKTOK_COMMENT_DELETE_API
} from '../../../lib/constants';
import { 
  getFieldStringValue, 
  findOrCreateField 
} from '../../../lib/fieldUtils';

const { Title, Text } = Typography;

// 评论字段映射：API返回的字段名 -> 表格中的中文字段名（精简版，不超过10个字）
const COMMENT_FIELD_MAPPING: Record<string, string> = {
  'comment_id': '评论ID',
  'video_id': '视频ID',
  'text': '评论内容',
  'username': '用户名',
  'display_name': '显示名称',
  'likes': '点赞数',
  'replies': '回复数',
  'status': '状态',
  'create_time': '发布时间',
  'owner': '是否自有',
  'liked': '已点赞',
  'pinned': '已置顶',
  'parent_comment_id': '父评论ID',
};

// 回复相关字段
const REPLY_FIELD_NAME = '回复内容';
const REPLIED_FIELD_NAME = '已回复';

// 默认获取的评论字段
const DEFAULT_COMMENT_FIELDS = [
  'comment_id',
  'video_id', 
  'text',
  'username',
  'display_name',
  'likes',
  'replies',
  'status',
  'create_time',
  'owner',
  'liked',
  'pinned',
];

export default function CommentManagement() {
  const [accountTableMetaList, setAccountTableMetaList] = useState<ITableMeta[]>();
  const [videoTableMetaList, setVideoTableMetaList] = useState<ITableMeta[]>();
  const [commentTableMetaList, setCommentTableMetaList] = useState<ITableMeta[]>();
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  
  const formApi = useRef<BaseFormApi>();

  // 刷新Token
  const refreshToken = useCallback(async (refreshTokenValue: string): Promise<any> => {
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

      if (result.code !== 0 && result.error) {
        throw new Error(result.error || result.message || 'Token刷新失败');
      }

      if (result.data?.access_token) {
        console.log(`✅ Token刷新成功`);
        return result.data;
      }

      throw new Error('Token刷新响应格式错误');
    } catch (error: any) {
      console.error(`Token刷新失败:`, error);
      throw error;
    }
  }, []);

  // 批量回复评论
  const handleBatchReply = useCallback(async () => {
    const values = formApi.current?.getValues();
    const { accountTable: accountTableId, commentTable: commentTableId } = values || {};

    if (!accountTableId || !commentTableId) {
      Toast.error('请选择账号列表和评论列表');
      return;
    }

    setReplyLoading(true);
    setProgress(0);
    setStatus('开始批量回复评论...');

    try {
      const accountTable = await bitable.base.getTableById(accountTableId);
      const commentTable = await bitable.base.getTableById(commentTableId);

      // 获取账号表字段
      const accountFieldList = await accountTable.getFieldList();
      let accessTokenField = accountFieldList.find((f: any) => f.name === 'access_token');
      let openIdField = accountFieldList.find((f: any) => f.name === 'open_id');
      let refreshTokenField: any = null;
      let tokenExpiresTimeField: any = null;

      for (const field of accountFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === 'refresh_token' || fieldName === '刷新令牌') {
            refreshTokenField = field;
          } else if (fieldName === 'token失效时间') {
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
          Toast.error('账号列表中未找到 access_token 字段');
          return;
        }
      }

      if (!openIdField) {
        try {
          openIdField = await accountTable.getFieldByName('open_id');
        } catch (e) {
          Toast.error('账号列表中未找到 open_id 字段');
          return;
        }
      }

      // 获取评论表字段
      const commentFieldList = await commentTable.getFieldList();
      
      // 查找必要的字段
      let commentIdField: any = null;
      let videoIdField: any = null;
      let accountIdField: any = null;
      let replyContentField: any = null;
      let repliedField: any = null;

      for (const field of commentFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === '评论ID') {
            commentIdField = field;
          } else if (fieldName === '视频ID') {
            videoIdField = field;
          } else if (fieldName === '账号ID') {
            accountIdField = field;
          } else if (fieldName === REPLY_FIELD_NAME) {
            replyContentField = field;
          } else if (fieldName === REPLIED_FIELD_NAME) {
            repliedField = field;
          }
        } catch (e) {
          console.warn('获取字段名称失败:', e);
        }
      }

      // 如果没有回复内容字段，创建它
      if (!replyContentField) {
        replyContentField = await findOrCreateField(commentTable, commentFieldList, REPLY_FIELD_NAME, FieldType.Text);
      }

      // 如果没有已回复字段，创建它
      if (!repliedField) {
        repliedField = await findOrCreateField(commentTable, commentFieldList, REPLIED_FIELD_NAME, FieldType.Checkbox);
      }

      if (!commentIdField || !videoIdField || !accountIdField) {
        Toast.error('评论列表缺少必要字段（评论ID、视频ID、账号ID）');
        return;
      }

      // 获取评论记录
      const commentRecordIdList = await commentTable.getRecordIdList();

      if (commentRecordIdList.length === 0) {
        Toast.warning('评论列表为空');
        return;
      }

      // 建立账号映射（open_id -> account info）
      const accountRecordIdList = await accountTable.getRecordIdList();
      const accountMap: Record<string, { recordId: string; accessToken: string }> = {};

      for (const accountRecordId of accountRecordIdList) {
        try {
          const openId = await getFieldStringValue(accountTable, openIdField, accountRecordId);
          let accessToken = await getFieldStringValue(accountTable, accessTokenField, accountRecordId);

          if (openId && accessToken) {
            // 检查并刷新Token
            if (tokenExpiresTimeField && refreshTokenField) {
              try {
                const expiresFieldValue = await tokenExpiresTimeField.getValue(accountRecordId);
                const expiresTimestamp = typeof expiresFieldValue === 'number' ? expiresFieldValue :
                  (expiresFieldValue ? Number(expiresFieldValue) : 0);

                const now = Date.now();
                if (expiresTimestamp > 0 && expiresTimestamp - now < 5 * 60 * 1000) {
                  const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, accountRecordId);
                  if (refreshTokenValue) {
                    const newTokenData = await refreshToken(String(refreshTokenValue).trim());
                    accessToken = newTokenData.access_token;

                    // 更新账号表
                    const updateFields: Record<string, any> = {};
                    updateFields[accessTokenField.id] = newTokenData.access_token;
                    if (newTokenData.refresh_token) {
                      updateFields[refreshTokenField.id] = newTokenData.refresh_token;
                    }
                    if (newTokenData.expires_in) {
                      updateFields[tokenExpiresTimeField.id] = now + newTokenData.expires_in * 1000;
                    }
                    await accountTable.setRecord(accountRecordId, { fields: updateFields });
                  }
                }
              } catch (e) {
                console.warn('Token刷新检查失败:', e);
              }
            }

            accountMap[openId] = { recordId: accountRecordId, accessToken: String(accessToken).trim() };
          }
        } catch (e) {
          console.warn('获取账号信息失败:', e);
        }
      }

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      // 遍历评论
      for (let i = 0; i < commentRecordIdList.length; i++) {
        const commentRecordId = commentRecordIdList[i];

        try {
          setProgress(Math.round((i / commentRecordIdList.length) * 100));

          // 检查是否已回复
          if (repliedField) {
            try {
              const repliedValue = await repliedField.getValue(commentRecordId);
              if (repliedValue === true) {
                console.log(`评论 ${commentRecordId} 已回复，跳过`);
                skipCount++;
                continue;
              }
            } catch (e) {
              // 字段可能不存在，继续处理
            }
          }

          // 获取回复内容
          const replyContent = replyContentField ? await getFieldStringValue(commentTable, replyContentField, commentRecordId) : null;

          if (!replyContent || String(replyContent).trim() === '') {
            console.log(`评论 ${commentRecordId} 回复内容为空，跳过`);
            skipCount++;
            continue;
          }

          // 获取评论信息
          const commentId = await getFieldStringValue(commentTable, commentIdField, commentRecordId);
          const videoId = await getFieldStringValue(commentTable, videoIdField, commentRecordId);
          const accountId = await getFieldStringValue(commentTable, accountIdField, commentRecordId);

          if (!commentId || !videoId || !accountId) {
            console.warn(`评论 ${commentRecordId} 缺少必要信息`);
            skipCount++;
            continue;
          }

          // 获取对应账号的 access_token
          const accountInfo = accountMap[accountId];
          if (!accountInfo) {
            console.warn(`未找到账号 ${accountId} 的信息`);
            skipCount++;
            continue;
          }

          setStatus(`回复评论 ${commentId}...`);

          // 调用回复API
          const response = await fetch(TIKTOK_COMMENT_REPLY_CREATE_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: accountInfo.accessToken,
              business_id: accountId,
              video_id: videoId,
              comment_id: commentId,
              text: String(replyContent).trim().substring(0, 150), // 最大150字符
            }),
          });

          const result = await response.json();

          if (result.code === 0) {
            console.log(`✅ 回复评论 ${commentId} 成功`);
            
            // 标记为已回复
            if (repliedField) {
              await commentTable.setRecord(commentRecordId, {
                fields: { [repliedField.id]: true }
              });
            }
            
            successCount++;
          } else {
            console.error(`回复评论 ${commentId} 失败:`, result.message);
            errorCount++;
          }

          // 防止请求过快
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (e) {
          console.error(`处理评论 ${commentRecordId} 失败:`, e);
          errorCount++;
        }
      }

      const message = `批量回复完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`;
      Toast.success(message);
      setStatus(message);

    } catch (error: any) {
      console.error('批量回复失败:', error);
      Toast.error(`批量回复失败: ${error.message || '未知错误'}`);
      setStatus(`批量回复失败: ${error.message || '未知错误'}`);
    } finally {
      setReplyLoading(false);
      setProgress(0);
    }
  }, [refreshToken]);

  // 获取评论列表
  const handleFetchComments = useCallback(async (values: any) => {
    const { accountTable: accountTableId, videoTable: videoTableId, commentTable: commentTableId } = values;

    if (!accountTableId || !videoTableId || !commentTableId) {
      Toast.error('请选择账号列表、视频列表和评论列表');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始获取评论...');

    try {
      // 获取账号表和视频表
      const accountTable = await bitable.base.getTableById(accountTableId);
      const videoTable = await bitable.base.getTableById(videoTableId);
      const commentTable = await bitable.base.getTableById(commentTableId);
      
      // 获取账号表字段
      const accountFieldList = await accountTable.getFieldList();
      let accessTokenField = accountFieldList.find((f: any) => f.name === 'access_token');
      let openIdField = accountFieldList.find((f: any) => f.name === 'open_id');
      let refreshTokenField: any = null;
      let tokenExpiresTimeField: any = null;

      // 查找字段
      for (const field of accountFieldList) {
        try {
          const fieldName = await field.getName();
          if (fieldName === 'refresh_token' || fieldName === '刷新令牌') {
            refreshTokenField = field;
          } else if (fieldName === 'token失效时间') {
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
          Toast.error('账号列表中未找到 access_token 字段');
          return;
        }
      }

      if (!openIdField) {
        try {
          openIdField = await accountTable.getFieldByName('open_id');
        } catch (e) {
          Toast.error('账号列表中未找到 open_id 字段');
          return;
        }
      }

      // 获取视频表字段
      const videoFieldList = await videoTable.getFieldList();
      let itemIdField = videoFieldList.find((f: any) => f.name === 'item_id');
      
      if (!itemIdField) {
        try {
          itemIdField = await videoTable.getFieldByName('item_id');
        } catch (e) {
          Toast.error('视频列表中未找到 item_id 字段');
          return;
        }
      }

      // 获取评论表字段列表
      let commentFieldList = await commentTable.getFieldList();

      // 获取账号记录
      const accountRecordIdList = await accountTable.getRecordIdList();
      
      if (accountRecordIdList.length === 0) {
        Toast.warning('账号列表为空');
        return;
      }

      // 获取视频记录
      const videoRecordIdList = await videoTable.getRecordIdList();
      
      if (videoRecordIdList.length === 0) {
        Toast.warning('视频列表为空');
        return;
      }

      setStatus(`开始处理 ${accountRecordIdList.length} 个账号的视频评论`);
      
      let totalComments = 0;
      let successCount = 0;
      let errorCount = 0;

      // 遍历账号
      for (let i = 0; i < accountRecordIdList.length; i++) {
        const accountRecordId = accountRecordIdList[i];
        
        try {
          // 获取账号信息
          const accessToken = await getFieldStringValue(accountTable, accessTokenField, accountRecordId);
          const openId = await getFieldStringValue(accountTable, openIdField, accountRecordId);

          if (!accessToken || !openId) {
            console.warn(`账号 ${i + 1} 缺少 access_token 或 open_id`);
            continue;
          }

          let accessTokenStr = String(accessToken).trim();

          // 检查并刷新Token
          if (tokenExpiresTimeField && refreshTokenField) {
            try {
              const expiresFieldValue = await tokenExpiresTimeField.getValue(accountRecordId);
              const expiresTimestamp = typeof expiresFieldValue === 'number' ? expiresFieldValue : 
                                       (expiresFieldValue ? Number(expiresFieldValue) : 0);
              
              const now = Date.now();
              if (expiresTimestamp > 0 && expiresTimestamp - now < 5 * 60 * 1000) {
                const refreshTokenValue = await getFieldStringValue(accountTable, refreshTokenField, accountRecordId);
                if (refreshTokenValue) {
                  const newTokenData = await refreshToken(String(refreshTokenValue).trim());
                  accessTokenStr = newTokenData.access_token;
                  
                  // 更新账号表
                  const updateFields: Record<string, any> = {};
                  updateFields[accessTokenField.id] = newTokenData.access_token;
                  if (newTokenData.refresh_token) {
                    updateFields[refreshTokenField.id] = newTokenData.refresh_token;
                  }
                  if (newTokenData.expires_in) {
                    updateFields[tokenExpiresTimeField.id] = now + newTokenData.expires_in * 1000;
                  }
                  await accountTable.setRecord(accountRecordId, { fields: updateFields });
                }
              }
            } catch (e) {
              console.warn('Token刷新检查失败:', e);
            }
          }

          // 遍历视频
          for (let j = 0; j < videoRecordIdList.length; j++) {
            const videoRecordId = videoRecordIdList[j];
            
            try {
              const videoId = await getFieldStringValue(videoTable, itemIdField, videoRecordId);
              
              if (!videoId) {
                continue;
              }

              setProgress(Math.round(((i * videoRecordIdList.length + j) / (accountRecordIdList.length * videoRecordIdList.length)) * 100));
              setStatus(`获取视频 ${videoId} 的评论...`);

              // 调用API获取评论
              const apiUrl = `${TIKTOK_COMMENT_LIST_API}?access_token=${encodeURIComponent(accessTokenStr)}&business_id=${encodeURIComponent(openId)}&video_id=${encodeURIComponent(videoId)}&max_count=30&include_replies=true`;
              
              const response = await fetch(apiUrl);
              const result = await response.json();

              if (result.code !== 0) {
                console.warn(`获取视频 ${videoId} 评论失败:`, result.message);
                continue;
              }

              const comments = result.data?.comments || [];
              console.log(`视频 ${videoId} 获取到 ${comments.length} 条评论`);

              // 保存评论到评论表
              for (const comment of comments) {
                try {
                  // 跳过内容为空的评论
                  if (!comment.text || String(comment.text).trim() === '') {
                    console.log(`跳过空评论: comment_id=${comment.comment_id}`);
                    continue;
                  }

                  // 刷新评论表引用
                  const commentTableRef = await bitable.base.getTableById(commentTableId);
                  commentFieldList = await commentTableRef.getFieldList();

                  const fields: Record<string, any> = {};

                  // 遍历评论数据
                  for (const [key, value] of Object.entries(comment)) {
                    if (value === null || value === undefined) continue;

                    const fieldName = COMMENT_FIELD_MAPPING[key] || key;
                    
                    // 查找或创建字段
                    let field = await findOrCreateField(
                      commentTableRef,
                      commentFieldList,
                      fieldName,
                      typeof value === 'number' ? FieldType.Number :
                      typeof value === 'boolean' ? FieldType.Checkbox :
                      FieldType.Text
                    );

                    if (field) {
                      // 转换值
                      let fieldValue = value;
                      if (typeof value === 'boolean') {
                        fieldValue = value;
                      } else if (typeof value === 'number') {
                        fieldValue = value;
                      } else {
                        fieldValue = String(value);
                      }
                      fields[field.id] = fieldValue;
                    }
                  }

                  // 添加 open_id 字段关联账号
                  let openIdCommentField = await findOrCreateField(commentTableRef, commentFieldList, '账号ID', FieldType.Text);
                  if (openIdCommentField) {
                    fields[openIdCommentField.id] = openId;
                  }

                  // 过滤无效值
                  const validFields: Record<string, any> = {};
                  for (const [fieldId, fieldValue] of Object.entries(fields)) {
                    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                      validFields[fieldId] = fieldValue;
                    }
                  }

                  // 检查是否已存在
                  const commentIdField = await findOrCreateField(commentTableRef, commentFieldList, '评论ID', FieldType.Text);
                  let existingRecordId: string | null = null;
                  
                  if (commentIdField && comment.comment_id) {
                    const recordIds = await commentTableRef.getRecordIdList();
                    for (const rid of recordIds) {
                      const existingCommentId = await getFieldStringValue(commentTableRef, commentIdField, rid);
                      if (existingCommentId === String(comment.comment_id)) {
                        existingRecordId = rid;
                        break;
                      }
                    }
                  }

                  if (existingRecordId) {
                    await commentTableRef.setRecord(existingRecordId, { fields: validFields });
                  } else {
                    await commentTableRef.addRecord({ fields: validFields });
                    totalComments++;
                  }

                } catch (e) {
                  console.error(`保存评论失败:`, e);
                  errorCount++;
                }
              }

              successCount++;
            } catch (e) {
              console.error(`处理视频评论失败:`, e);
              errorCount++;
            }
          }
        } catch (e) {
          console.error(`处理账号 ${i + 1} 失败:`, e);
          errorCount++;
        }
      }

      const message = `获取完成！新增评论: ${totalComments}，成功视频: ${successCount}，失败: ${errorCount}`;
      Toast.success(message);
      setStatus(message);

    } catch (error: any) {
      console.error('获取评论失败:', error);
      Toast.error(`获取失败: ${error.message || '未知错误'}`);
      setStatus(`获取失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [refreshToken]);

  useEffect(() => {
    Promise.all([
      bitable.base.getTableMetaList(),
      bitable.base.getSelection()
    ]).then(([metaList, selection]) => {
      setAccountTableMetaList(metaList);
      setVideoTableMetaList(metaList);
      setCommentTableMetaList(metaList);
      
      // 根据表名查找并默认选中
      const accountTableId = metaList.find(table => table.name === '账号列表')?.id || selection.tableId;
      const videoTableId = metaList.find(table => table.name === '视频列表')?.id || selection.tableId;
      const commentTableId = metaList.find(table => table.name === '评论列表')?.id || selection.tableId;
      
      formApi.current?.setValues({ 
        accountTable: accountTableId,
        videoTable: videoTableId,
        commentTable: commentTableId
      });
    });
  }, []);

  // 样式常量 - 遵循 Base 开放设计规范
  const styles = {
    container: {
      padding: '0 4px',
    },
    header: {
      marginBottom: 16,
    },
    card: {
      marginBottom: 16,
      borderRadius: 8,
    },
    cardBody: {
      padding: '16px 20px',
    },
    sectionTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    formItem: {
      marginBottom: 16,
    },
    progressContainer: {
      marginTop: 16,
      marginBottom: 8,
    },
    buttonGroup: {
      display: 'flex',
      gap: 12,
      marginTop: 20,
    },
    infoCard: {
      backgroundColor: 'var(--semi-color-fill-0)',
      borderRadius: 8,
      padding: '12px 16px',
      marginTop: 8,
    },
    fieldList: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: 6,
      marginTop: 8,
    },
    fieldTag: {
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      backgroundColor: 'var(--semi-color-primary-light-default)',
      color: 'var(--semi-color-primary)',
    },
    fieldTagSecondary: {
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 12,
      backgroundColor: 'var(--semi-color-warning-light-default)',
      color: 'var(--semi-color-warning)',
    },
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <Title heading={5} style={{ marginBottom: 4, color: 'var(--semi-color-text-0)' }}>
          评论管理
        </Title>
        <Text type="tertiary" size="small">
          获取并管理 TikTok 视频的评论数据，支持批量回复操作
        </Text>
      </div>

      {/* 数据源配置 */}
      <Card 
        style={styles.card}
        bodyStyle={styles.cardBody}
        bordered={false}
        shadows='hover'
      >
        <div style={styles.sectionTitle}>
          <IconComment style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>数据源配置</Text>
        </div>
        
        <Form 
          labelPosition='top' 
          onSubmit={handleFetchComments} 
          getFormApi={(api: BaseFormApi) => formApi.current = api}
        >
          <Form.Select 
            field='accountTable' 
            label='账号列表'
            placeholder='选择包含 Token 的账号数据表'
            style={{ width: '100%' }}
            optionList={accountTableMetaList?.map(table => ({
              label: table.name,
              value: table.id
            }))}
          />

          <Form.Select 
            field='videoTable' 
            label='视频列表'
            placeholder='选择包含 item_id 的视频数据表'
            style={{ width: '100%' }}
            optionList={videoTableMetaList?.map(table => ({
              label: table.name,
              value: table.id
            }))}
          />

          <Form.Select 
            field='commentTable' 
            label='评论列表'
            placeholder='选择用于存储评论的数据表'
            style={{ width: '100%' }}
            optionList={commentTableMetaList?.map(table => ({
              label: table.name,
              value: table.id
            }))}
          />

          {/* 进度显示 */}
          {(loading || replyLoading) && (
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
              disabled={replyLoading}
              icon={<IconRefresh />}
              className="btn-primary"
            >
              获取评论
            </Button>
            <Button 
              loading={replyLoading}
              disabled={loading}
              onClick={handleBatchReply}
              icon={<IconSend />}
              className="btn-secondary"
            >
              批量回复
            </Button>
          </div>
        </Form>
      </Card>

      {/* 使用说明 */}
      <Card 
        style={styles.card}
        bodyStyle={styles.cardBody}
        bordered={false}
        shadows='hover'
      >
        <Text strong size="small" style={{ color: 'var(--semi-color-text-0)', display: 'block', marginBottom: 12 }}>
          使用说明
        </Text>

        {/* 获取评论说明 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>
            1. 获取评论
          </Text>
          <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
            系统会自动在评论列表中创建以下字段：
          </Text>
          <div style={styles.fieldList}>
            {Object.values(COMMENT_FIELD_MAPPING).slice(0, 8).map(name => (
              <span key={name} style={styles.fieldTag}>{name}</span>
            ))}
            <span style={styles.fieldTag}>账号ID</span>
          </div>
        </div>

        <Divider margin={12} />

        {/* 批量回复说明 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)' }}>
            2. 批量回复
          </Text>
          <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
            在评论列表中填写以下字段后，点击批量回复即可自动回复：
          </Text>
          <div style={styles.fieldList}>
            <span style={styles.fieldTagSecondary}>{REPLY_FIELD_NAME}</span>
            <span style={styles.fieldTagSecondary}>{REPLIED_FIELD_NAME}</span>
          </div>
          <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
            系统会跳过【{REPLIED_FIELD_NAME}】已勾选的评论，回复成功后自动勾选
          </Text>
        </div>
      </Card>

      {/* 提示信息 */}
      <Banner 
        type="info"
        description="每次回复间隔 500ms，避免请求过快被限制。回复内容最多 150 字符。"
        style={{ borderRadius: 8 }}
      />
    </div>
  );
}
