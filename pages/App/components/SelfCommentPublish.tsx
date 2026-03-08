'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Card, Banner, TextArea, Select, Space } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { TIKTOK_COMMENT_CREATE_API } from '../../../lib/constants';
import { getAccessTokenByRecordId } from '../../../lib/tokenUtils';

const { Title, Text } = Typography;

export default function SelfCommentPublish() {
  const [videoTableMetaList, setVideoTableMetaList] = useState<ITableMeta[]>();
  const [accountTableMetaList, setAccountTableMetaList] = useState<ITableMeta[]>();
  const [videoList, setVideoList] = useState<Array<{ value: string; label: string; recordId: string }>>([]);
  const [accountList, setAccountList] = useState<Array<{ value: string; label: string; recordId: string }>>([]);
  const [loading, setLoading] = useState(false);
  const formApi = useRef<BaseFormApi>();

  // 初始化：获取数据表列表并设置默认值
  useEffect(() => {
    const init = async () => {
      try {
        const [tableMetaList, selection] = await Promise.all([
          bitable.base.getTableMetaList(),
          bitable.base.getSelection()
        ]);

        setVideoTableMetaList(tableMetaList);
        setAccountTableMetaList(tableMetaList);

        // 查找默认表
        const videoTable = tableMetaList.find(t => t.name === '视频列表') ||
                          tableMetaList.find(t => t.name.includes('视频'));
        const accountTable = tableMetaList.find(t => t.name === '账号列表') ||
                            tableMetaList.find(t => t.name.includes('账号'));

        // 设置默认值
        if (formApi.current) {
          formApi.current.setValues({
            videoTable: videoTable?.id || selection.tableId,
            accountTable: accountTable?.id || selection.tableId
          });

          // 自动加载默认表的数据
          if (videoTable?.id) {
            await loadVideoList(videoTable.id);
          }
          if (accountTable?.id) {
            await loadAccountList(accountTable.id);
          }
        }
      } catch (e) {
        console.error('初始化失败:', e);
        Toast.error('初始化失败，请刷新页面重试');
      }
    };
    init();
  }, []);

  // 加载视频列表
  const loadVideoList = async (tableId: string) => {
    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldMetaList = await table.getFieldMetaList();

      // 查找必要字段
      const videoIdField = fieldMetaList.find(f =>
        f.name === 'video_id' || f.name === '视频ID' || f.name === 'item_id'
      );
      const titleField = fieldMetaList.find(f =>
        f.name === 'title' || f.name === '标题' || f.name === 'caption'
      );

      if (!videoIdField) {
        Toast.warning('视频表缺少必要字段：video_id 或 视频ID');
        return;
      }

      const recordIdList = await table.getRecordIdList();
      const videos: Array<{ value: string; label: string; recordId: string }> = [];

      for (const recordId of recordIdList) {
        const videoIdValue = await table.getCellValue(videoIdField.id, recordId);
        const titleValue = titleField ? await table.getCellValue(titleField.id, recordId) : '';

        // 处理 video_id 可能的对象类型
        let videoId = '';
        if (videoIdValue) {
          if (typeof videoIdValue === 'string') {
            videoId = videoIdValue;
          } else if (Array.isArray(videoIdValue) && videoIdValue.length > 0) {
            const firstItem = videoIdValue[0];
            videoId = String((firstItem as any)?.text || firstItem);
          } else if (typeof videoIdValue === 'object' && videoIdValue !== null) {
            videoId = String((videoIdValue as any).text || videoIdValue);
          } else {
            videoId = String(videoIdValue);
          }
        }

        // 处理可能的对象类型，提取文本内容
        let title = '';
        if (titleValue) {
          if (typeof titleValue === 'string') {
            title = titleValue;
          } else if (Array.isArray(titleValue) && titleValue.length > 0) {
            const firstItem = titleValue[0];
            title = String((firstItem as any)?.text || firstItem);
          } else if (typeof titleValue === 'object' && titleValue !== null) {
            title = String((titleValue as any).text || titleValue);
          } else {
            title = String(titleValue);
          }
        }

        if (videoId) {
          videos.push({
            value: videoId,
            label: title ? `${title} (${videoId})` : videoId,
            recordId
          });
        }
      }

      setVideoList(videos);
      console.log(`加载了 ${videos.length} 个视频`);
    } catch (e) {
      console.error('加载视频列表失败:', e);
      Toast.error('加载视频列表失败');
    }
  };

  // 加载账号列表
  const loadAccountList = async (tableId: string) => {
    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldMetaList = await table.getFieldMetaList();

      const openIdField = fieldMetaList.find(f => f.name === 'open_id' || f.name === 'business_id');
      const usernameField = fieldMetaList.find(f =>
        f.name === 'username' || f.name === '用户名' || f.name === 'display_name' || f.name === '账号展示名'
      );
      const accessTokenField = fieldMetaList.find(f => f.name === 'access_token' || f.name === '访问令牌');

      if (!openIdField || !accessTokenField) {
        Toast.warning('账号表缺少必要字段：open_id 和 access_token');
        return;
      }

      const recordIdList = await table.getRecordIdList();
      const accounts: Array<{ value: string; label: string; recordId: string }> = [];

      for (const recordId of recordIdList) {
        const openIdValue = await table.getCellValue(openIdField.id, recordId);
        const usernameValue = usernameField ? await table.getCellValue(usernameField.id, recordId) : '';
        const accessToken = await table.getCellValue(accessTokenField.id, recordId);

        // 处理 open_id 可能的对象类型
        let openId = '';
        if (openIdValue) {
          if (typeof openIdValue === 'string') {
            openId = openIdValue;
          } else if (Array.isArray(openIdValue) && openIdValue.length > 0) {
            const firstItem = openIdValue[0];
            openId = String((firstItem as any)?.text || firstItem);
          } else if (typeof openIdValue === 'object' && openIdValue !== null) {
            openId = String((openIdValue as any).text || openIdValue);
          } else {
            openId = String(openIdValue);
          }
        }

        // 处理可能的对象类型，提取文本内容
        let username = '';
        if (usernameValue) {
          if (typeof usernameValue === 'string') {
            username = usernameValue;
          } else if (Array.isArray(usernameValue) && usernameValue.length > 0) {
            const firstItem = usernameValue[0];
            username = String((firstItem as any)?.text || firstItem);
          } else if (typeof usernameValue === 'object' && usernameValue !== null) {
            username = String((usernameValue as any).text || usernameValue);
          } else {
            username = String(usernameValue);
          }
        }

        if (openId && accessToken) {
          accounts.push({
            value: recordId,
            label: username ? `${username} (${openId})` : openId,
            recordId
          });
        }
      }

      setAccountList(accounts);
      console.log(`加载了 ${accounts.length} 个账号`);
    } catch (e) {
      console.error('加载账号列表失败:', e);
      Toast.error('加载账号列表失败');
    }
  };

  // 发送评论
  const handleSendComment = async (values: any) => {
    if (!values.video || !values.account || !values.commentText) {
      Toast.warning('请填写完整信息');
      return;
    }

    setLoading(true);

    try {
      // 获取账号表
      const accountTable = await bitable.base.getTableById(values.accountTable);
      const accountFieldMetaList = await accountTable.getFieldMetaList();

      // 使用 tokenUtils 获取并自动刷新 access_token
      const accessToken = await getAccessTokenByRecordId(accountTable, values.account);

      if (!accessToken) {
        Toast.error('无法获取有效的 access_token');
        setLoading(false);
        return;
      }

      // 获取 business_id (open_id)
      const openIdField = accountFieldMetaList.find(f => f.name === 'open_id' || f.name === 'business_id');
      if (!openIdField) {
        Toast.error('账号表缺少 open_id 字段');
        setLoading(false);
        return;
      }

      const businessIdValue = await accountTable.getCellValue(openIdField.id, values.account);

      if (!businessIdValue) {
        Toast.error('该账号没有 open_id');
        setLoading(false);
        return;
      }

      // 处理 business_id 可能的对象类型
      let businessId = '';
      if (typeof businessIdValue === 'string') {
        businessId = businessIdValue;
      } else if (Array.isArray(businessIdValue) && businessIdValue.length > 0) {
        const firstItem = businessIdValue[0];
        businessId = String((firstItem as any)?.text || firstItem);
      } else if (typeof businessIdValue === 'object' && businessIdValue !== null) {
        businessId = String((businessIdValue as any).text || businessIdValue);
      } else {
        businessId = String(businessIdValue);
      }

      // 处理 video_id 可能的对象类型
      let videoId = '';
      if (typeof values.video === 'string') {
        videoId = values.video;
      } else if (Array.isArray(values.video) && values.video.length > 0) {
        const firstItem = values.video[0];
        videoId = String((firstItem as any)?.text || firstItem);
      } else if (typeof values.video === 'object' && values.video !== null) {
        videoId = String((values.video as any).text || values.video);
      } else {
        videoId = String(values.video);
      }

      console.log('发送评论:', {
        business_id: businessId,
        video_id: videoId,
        text: values.commentText
      });

      // 调用 API 发送评论
      const response = await fetch(TIKTOK_COMMENT_CREATE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          business_id: businessId,
          video_id: videoId,
          text: values.commentText
        })
      });

      const result = await response.json();

      if (result.code === 0 && result.data && result.data.comment_id) {
        Toast.success(`评论发送成功！Comment ID: ${result.data.comment_id}`);
        console.log('评论发送成功:', result.data);

        // 清空评论内容
        formApi.current?.setValue('commentText', '');
      } else {
        const errorMsg = result.error || result.message || '发送评论失败';
        Toast.error(`发送失败: ${errorMsg}`);
        console.error('发送评论失败:', result);
      }
    } catch (error: any) {
      console.error('发送评论失败:', error);
      Toast.error(`发送失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '0 4px' }}>
      <Banner
        type="info"
        description="给自己的 TikTok 视频发送评论。适用于新视频冷启动、增加互动、引导评论等场景。注意：避免在短时间内发布大量内容高度相似的评论，以防被系统标记为垃圾评论。"
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <Card style={{ marginBottom: 16, borderRadius: 8 }} bodyStyle={{ padding: '20px' }}>
        <Title heading={6} style={{ marginBottom: 16 }}>发送评论</Title>

        <Form
          getFormApi={(api) => formApi.current = api}
          labelPosition="left"
          labelWidth={100}
          onSubmit={handleSendComment}
        >
          <Form.Select
            field="accountTable"
            label="账号表"
            placeholder="选择包含账号信息的数据表"
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择账号表' }]}
            onChange={(value) => {
              if (value) {
                loadAccountList(value as string);
              }
            }}
          >
            {accountTableMetaList?.map(table => (
              <Form.Select.Option key={table.id} value={table.id}>
                {table.name}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="account"
            label="选择账号"
            placeholder="选择要使用的账号"
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择账号' }]}
            filter
          >
            {accountList.map(account => (
              <Form.Select.Option key={account.value} value={account.value}>
                {account.label}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="videoTable"
            label="视频表"
            placeholder="选择包含视频信息的数据表"
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择视频表' }]}
            onChange={(value) => {
              if (value) {
                loadVideoList(value as string);
              }
            }}
          >
            {videoTableMetaList?.map(table => (
              <Form.Select.Option key={table.id} value={table.id}>
                {table.name}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="video"
            label="选择视频"
            placeholder="选择要评论的视频"
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择视频' }]}
            filter
            showClear
          >
            {videoList.map(video => (
              <Form.Select.Option key={video.value} value={video.value}>
                {video.label}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.TextArea
            field="commentText"
            label="评论内容"
            placeholder="输入评论内容（最多150个字符）"
            style={{ width: '100%' }}
            maxLength={150}
            showClear
            autosize
            rows={3}
            rules={[
              { required: true, message: '请输入评论内容' },
              { max: 150, message: '评论内容不能超过150个字符' }
            ]}
          />

          <Space style={{ marginTop: 16 }}>
            <Button
              htmlType="submit"
              type="primary"
              icon={<IconSend />}
              loading={loading}
              style={{ minWidth: 120 }}
            >
              发送评论
            </Button>
            <Button
              type="tertiary"
              onClick={() => formApi.current?.reset()}
              disabled={loading}
            >
              重置
            </Button>
          </Space>
        </Form>
      </Card>

      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: '16px' }}>
        <Title heading={6} style={{ marginBottom: 12 }}>使用提示</Title>
        <Space vertical align="start" spacing="tight">
          <Text type="tertiary" size="small">• 评论内容最多150个字符（UTF-8编码）</Text>
          <Text type="tertiary" size="small">• 避免发送垃圾评论或重复内容</Text>
          <Text type="tertiary" size="small">• 建议每个视频发送1-3条有意义的评论</Text>
          <Text type="tertiary" size="small">• 评论需遵守 TikTok 社区规范</Text>
          <Text type="tertiary" size="small">• 确保账号 Token 包含评论权限</Text>
        </Space>
      </Card>
    </div>
  );
}
