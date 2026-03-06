'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Input, Toast, Typography, Space, Card, Banner, Progress, Table, Tag, TextArea } from '@douyinfe/semi-ui';
import { IconSend, IconRefresh, IconTickCircle } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef } from 'react';
import { TIKTOK_COMMENT_CREATE_API, TIKTOK_COMMENT_LIST_API } from '../../../lib/constants';

const { Title, Text } = Typography;

interface CommentTask {
  id: string;
  videoId: string;
  videoTitle: string;
  commentText: string;
  status: 'pending' | 'sending' | 'sent' | 'verifying' | 'success' | 'failed';
  commentId?: string;
  error?: string;
  sentTime?: number;
}

export default function SelfCommentPublish() {
  const [videoTableMetaList, setVideoTableMetaList] = useState<ITableMeta[]>();
  const [accountTableMetaList, setAccountTableMetaList] = useState<ITableMeta[]>();
  const [commentTasks, setCommentTasks] = useState<CommentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // 初始化：获取数据表列表
  useEffect(() => {
    const init = async () => {
      try {
        const tableMetaList = await bitable.base.getTableMetaList();
        setVideoTableMetaList(tableMetaList);
        setAccountTableMetaList(tableMetaList);
      } catch (e) {
        console.error('初始化失败:', e);
        Toast.error('初始化失败，请刷新页面重试');
      }
    };
    init();
  }, []);

  // 加载视频和评论内容
  const loadVideosAndComments = async (videoTableId: string, commentFieldName: string) => {
    try {
      const table = await bitable.base.getTableById(videoTableId);
      const fieldMetaList = await table.getFieldMetaList();

      // 查找必要字段
      const videoIdField = fieldMetaList.find(f => f.name === 'video_id' || f.name === '视频ID');
      const titleField = fieldMetaList.find(f => f.name === 'title' || f.name === '标题' || f.name === 'caption');
      const commentField = fieldMetaList.find(f => f.name === commentFieldName);

      if (!videoIdField) {
        Toast.error('视频表缺少必要字段：video_id 或 视频ID');
        return;
      }

      if (!commentField) {
        Toast.error(`未找到评论字段：${commentFieldName}`);
        return;
      }

      const recordIdList = await table.getRecordIdList();
      const tasks: CommentTask[] = [];

      for (const recordId of recordIdList) {
        const videoId = await table.getCellValue(videoIdField.id, recordId);
        const title = titleField ? await table.getCellValue(titleField.id, recordId) : '';
        const commentText = await table.getCellValue(commentField.id, recordId);

        if (videoId && commentText) {
          tasks.push({
            id: recordId,
            videoId: String(videoId),
            videoTitle: String(title || videoId),
            commentText: String(commentText),
            status: 'pending'
          });
        }
      }

      setCommentTasks(tasks);
      Toast.success(`加载了 ${tasks.length} 条待发送评论`);
    } catch (e) {
      console.error('加载视频失败:', e);
      Toast.error('加载视频失败');
    }
  };

  // 加载账号 Token
  const loadAccountToken = async (accountTableId: string, accountRecordId: string) => {
    try {
      const table = await bitable.base.getTableById(accountTableId);
      const fieldMetaList = await table.getFieldMetaList();

      const accessTokenField = fieldMetaList.find(f => f.name === 'access_token' || f.name === '访问令牌');

      if (!accessTokenField) {
        Toast.error('账号表缺少必要字段：access_token');
        return;
      }

      const token = await table.getCellValue(accessTokenField.id, accountRecordId);
      if (token) {
        setAccessToken(String(token));
        setSelectedAccountId(accountRecordId);
        Toast.success('账号 Token 加载成功');
      } else {
        Toast.error('该账号没有 access_token');
      }
    } catch (e) {
      console.error('加载账号 Token 失败:', e);
      Toast.error('加载账号 Token 失败');
    }
  };

  // 发送单条评论
  const sendComment = async (videoId: string, commentText: string): Promise<string> => {
    const response = await fetch(TIKTOK_COMMENT_CREATE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        video_id: videoId,
        text: commentText
      })
    });

    const result = await response.json();

    if (result.code === 0 && result.data && result.data.comment_id) {
      return result.data.comment_id;
    } else {
      throw new Error(result.error || result.message || '发送评论失败');
    }
  };

  // 获取视频评论列表
  const getVideoComments = async (videoId: string): Promise<any[]> => {
    const response = await fetch(
      `${TIKTOK_COMMENT_LIST_API}?access_token=${encodeURIComponent(accessToken)}&video_id=${encodeURIComponent(videoId)}&count=100`
    );

    const result = await response.json();

    if (result.code === 0 && result.data && result.data.comments) {
      return result.data.comments;
    } else {
      throw new Error(result.error || result.message || '获取评论列表失败');
    }
  };

  // 验证评论是否发送成功
  const verifyComment = async (videoId: string, commentId: string, commentText: string): Promise<boolean> => {
    try {
      const comments = await getVideoComments(videoId);

      // 查找匹配的评论
      const found = comments.find(c =>
        c.comment_id === commentId || c.text === commentText
      );

      return !!found;
    } catch (error) {
      console.error('验证评论失败:', error);
      return false;
    }
  };

  // 批量发送评论
  const handleBatchSend = async () => {
    if (commentTasks.length === 0) {
      Toast.warning('请先加载视频和评论内容');
      return;
    }

    if (!accessToken) {
      Toast.warning('请先加载账号 Token');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始批量发送评论...');

    try {
      for (let i = 0; i < commentTasks.length; i++) {
        const task = commentTasks[i];
        setProgress(Math.round(((i + 1) / commentTasks.length) * 100));
        setStatus(`处理评论 ${i + 1}/${commentTasks.length}: ${task.videoTitle}`);

        try {
          // 1. 发送评论
          setCommentTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: 'sending' } : t
          ));

          const commentId = await sendComment(task.videoId, task.commentText);
          const sentTime = Date.now();

          setCommentTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: 'sent', commentId, sentTime } : t
          ));

          console.log(`✅ 评论发送成功: ${commentId}`);

          // 2. 等待 5 秒后验证
          setCommentTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: 'verifying' } : t
          ));

          await new Promise(resolve => setTimeout(resolve, 5000));

          // 3. 验证评论是否成功
          const verified = await verifyComment(task.videoId, commentId, task.commentText);

          if (verified) {
            setCommentTasks(prev => prev.map(t =>
              t.id === task.id ? { ...t, status: 'success' } : t
            ));
            console.log(`✅ 评论验证成功: ${commentId}`);
          } else {
            setCommentTasks(prev => prev.map(t =>
              t.id === task.id ? { ...t, status: 'failed', error: '验证失败：未在评论列表中找到' } : t
            ));
            console.warn(`⚠️ 评论验证失败: ${commentId}`);
          }

        } catch (error: any) {
          console.error(`处理评论失败:`, error);
          setCommentTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: 'failed', error: error.message } : t
          ));
        }

        // 延迟，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      Toast.success('批量处理完成！');
    } catch (error: any) {
      console.error('批量处理失败:', error);
      Toast.error(`批量处理失败: ${error.message}`);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  // 清空列表
  const handleClear = () => {
    setCommentTasks([]);
    setProgress(0);
    setStatus('');
  };

  // 表格列定义
  const columns = [
    {
      title: '视频标题',
      dataIndex: 'videoTitle',
      width: 200,
      render: (text: string) => <Text ellipsis={{ showTooltip: true }}>{text}</Text>
    },
    {
      title: '评论内容',
      dataIndex: 'commentText',
      width: 250,
      render: (text: string) => <Text ellipsis={{ showTooltip: true }}>{text}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => {
        const statusMap: Record<string, { color: 'grey' | 'blue' | 'cyan' | 'orange' | 'green' | 'red'; text: string }> = {
          pending: { color: 'grey', text: '待发送' },
          sending: { color: 'blue', text: '发送中' },
          sent: { color: 'cyan', text: '已发送' },
          verifying: { color: 'orange', text: '验证中' },
          success: { color: 'green', text: '成功' },
          failed: { color: 'red', text: '失败' }
        };
        const { color, text } = statusMap[status] || { color: 'grey', text: '未知' };
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Comment ID',
      dataIndex: 'commentId',
      width: 200,
      render: (id: string) => id ? <Text copyable>{id}</Text> : '-'
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      render: (error: string) => error ? <Text type="danger">{error}</Text> : '-'
    }
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <Banner
        type="info"
        description="给自己的视频批量发送评论，发送后自动验证评论是否成功。适用于新视频冷启动、增加互动等场景。"
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Form labelPosition="left" labelWidth={120}>
          <Form.Select
            field="accountTable"
            label="选择账号表"
            placeholder="选择包含账号信息的数据表"
            style={{ width: '100%' }}
          >
            {accountTableMetaList?.map(table => (
              <Form.Select.Option key={table.id} value={table.id}>
                {table.name}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.Select
            field="accountRecord"
            label="选择账号"
            placeholder="选择要使用的账号"
            style={{ width: '100%' }}
            onChange={(value) => {
              const accountTableId = (document.querySelector('[name="accountTable"]') as any)?.value;
              if (accountTableId && value) {
                loadAccountToken(accountTableId, value as string);
              }
            }}
          >
            {/* 需要动态加载账号列表 */}
          </Form.Select>

          <Form.Select
            field="videoTable"
            label="选择视频表"
            placeholder="选择包含视频信息的数据表"
            style={{ width: '100%' }}
          >
            {videoTableMetaList?.map(table => (
              <Form.Select.Option key={table.id} value={table.id}>
                {table.name}
              </Form.Select.Option>
            ))}
          </Form.Select>

          <Form.Input
            field="commentField"
            label="评论字段名"
            placeholder="输入评论内容所在的字段名，如：评论内容"
            style={{ width: '100%' }}
          />

          <Button
            type="primary"
            onClick={() => {
              const videoTableId = (document.querySelector('[name="videoTable"]') as any)?.value;
              const commentField = (document.querySelector('[name="commentField"]') as any)?.value;
              if (videoTableId && commentField) {
                loadVideosAndComments(videoTableId, commentField);
              } else {
                Toast.warning('请填写完整信息');
              }
            }}
          >
            加载视频和评论
          </Button>
        </Form>
      </Card>

      {commentTasks.length > 0 && (
        <Card
          title={`评论任务列表 (${commentTasks.length})`}
          headerExtraContent={
            <Space>
              <Button
                type="danger"
                theme="borderless"
                onClick={handleClear}
                disabled={loading}
              >
                清空
              </Button>
              <Button
                icon={<IconSend />}
                type="primary"
                onClick={handleBatchSend}
                loading={loading}
                disabled={!accessToken}
              >
                开始批量发送
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Table
            columns={columns}
            dataSource={commentTasks}
            pagination={false}
            size="small"
            rowKey="id"
          />
        </Card>
      )}

      {loading && (
        <Card>
          <Space vertical align="start" style={{ width: '100%' }}>
            <Text>{status}</Text>
            <Progress percent={progress} showInfo />
          </Space>
        </Card>
      )}
    </div>
  );
}
