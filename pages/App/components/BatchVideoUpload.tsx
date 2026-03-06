'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Toast, Typography, Space, Progress, Card, Banner, Upload, Select, Table, Tag } from '@douyinfe/semi-ui';
import { IconUpload, IconSend, IconDelete, IconRefresh } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef } from 'react';
import { UPLOAD_TO_OSS_API, PUBLISH_VIDEO_API } from '../../../lib/constants';
import { getFieldStringValue } from '../../../lib/fieldUtils';

const { Title, Text } = Typography;

interface VideoFile {
  uid: string;
  name: string;
  size: number;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'publishing' | 'success' | 'error';
  ossUrl?: string;
  assignedAccount?: string;
  publishId?: string;
  error?: string;
}

interface Account {
  recordId: string;
  openId: string;
  username: string;
  accessToken: string;
}

export default function BatchVideoUpload() {
  const [accountTableMetaList, setAccountTableMetaList] = useState<ITableMeta[]>();
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  // 初始化：获取数据表列表
  useEffect(() => {
    const init = async () => {
      try {
        const tableMetaList = await bitable.base.getTableMetaList();
        setAccountTableMetaList(tableMetaList);
      } catch (e) {
        console.error('初始化失败:', e);
        Toast.error('初始化失败，请刷新页面重试');
      }
    };
    init();
  }, []);

  // 加载账号列表
  const loadAccounts = async (tableId: string) => {
    try {
      const table = await bitable.base.getTableById(tableId);
      const fieldMetaList = await table.getFieldMetaList();

      // 查找必要字段
      const openIdField = fieldMetaList.find(f => f.name === 'open_id' || f.name === '账号ID');
      const usernameField = fieldMetaList.find(f => f.name === 'username' || f.name === '用户名');
      const accessTokenField = fieldMetaList.find(f => f.name === 'access_token' || f.name === '访问令牌');

      if (!openIdField || !accessTokenField) {
        Toast.error('账号表缺少必要字段：open_id 或 access_token');
        return;
      }

      const recordIdList = await table.getRecordIdList();
      const accountList: Account[] = [];

      for (const recordId of recordIdList) {
        const openId = await getFieldStringValue(table, openIdField, recordId);
        const username = usernameField ? await getFieldStringValue(table, usernameField, recordId) : null;
        const accessToken = await getFieldStringValue(table, accessTokenField, recordId);

        if (openId && accessToken) {
          accountList.push({
            recordId,
            openId,
            username: username || openId,
            accessToken
          });
        }
      }

      setAccounts(accountList);
      Toast.success(`加载了 ${accountList.length} 个账号`);
    } catch (e) {
      console.error('加载账号失败:', e);
      Toast.error('加载账号失败');
    }
  };

  // 处理文件上传
  const handleFileChange = (fileList: any) => {
    const newFiles: VideoFile[] = fileList.fileList.map((file: any) => ({
      uid: file.uid,
      name: file.name,
      size: file.size,
      file: file.fileInstance,
      status: 'pending'
    }));
    setVideoFiles(newFiles);
  };

  // 上传单个视频到 OSS
  const uploadVideoToOSS = async (file: File): Promise<string> => {
    // 将文件转换为 Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1]; // 移除 data:video/mp4;base64, 前缀

          const response = await fetch('/api/uploadFileDirect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData: base64Data,
              fileName: file.name,
              folder: 'tiktok-batch-videos',
              contentType: file.type || 'video/mp4'
            })
          });

          const result = await response.json();

          if (result.code === 0 && result.data && result.data.url) {
            resolve(result.data.url);
          } else {
            reject(new Error(result.error || result.message || '上传到OSS失败'));
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };

      reader.readAsDataURL(file);
    });
  };

  // 发布视频到 TikTok
  const publishVideoToTikTok = async (
    accessToken: string,
    openId: string,
    videoUrl: string,
    caption: string
  ): Promise<string> => {
    const response = await fetch(PUBLISH_VIDEO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        access_token: accessToken,
        business_id: openId,
        video_url: videoUrl,
        caption: caption || '批量发布视频',
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false
      })
    });

    const result = await response.json();

    if (result.code === 0 && result.data && result.data.publish_id) {
      return result.data.publish_id;
    } else {
      throw new Error(result.error || result.message || '发布视频失败');
    }
  };

  // 批量上传并发布
  const handleBatchPublish = async () => {
    if (videoFiles.length === 0) {
      Toast.warning('请先上传视频文件');
      return;
    }

    if (selectedAccountIds.length === 0) {
      Toast.warning('请选择至少一个账号');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus('开始批量处理...');

    const selectedAccounts = accounts.filter(acc => selectedAccountIds.includes(acc.recordId));
    let accountIndex = 0;

    try {
      for (let i = 0; i < videoFiles.length; i++) {
        const video = videoFiles[i];
        const account = selectedAccounts[accountIndex % selectedAccounts.length];

        setProgress(Math.round(((i + 1) / videoFiles.length) * 100));
        setStatus(`处理视频 ${i + 1}/${videoFiles.length}: ${video.name}`);

        try {
          // 更新状态：上传中
          setVideoFiles(prev => prev.map(v =>
            v.uid === video.uid ? { ...v, status: 'uploading', assignedAccount: account.username } : v
          ));

          // 1. 上传到 OSS
          const ossUrl = await uploadVideoToOSS(video.file);

          setVideoFiles(prev => prev.map(v =>
            v.uid === video.uid ? { ...v, status: 'uploaded', ossUrl } : v
          ));

          // 2. 发布到 TikTok
          setVideoFiles(prev => prev.map(v =>
            v.uid === video.uid ? { ...v, status: 'publishing' } : v
          ));

          const publishId = await publishVideoToTikTok(
            account.accessToken,
            account.openId,
            ossUrl,
            video.name.replace(/\.[^/.]+$/, '') // 使用文件名作为标题
          );

          setVideoFiles(prev => prev.map(v =>
            v.uid === video.uid ? { ...v, status: 'success', publishId } : v
          ));

          accountIndex++;
        } catch (error: any) {
          console.error(`处理视频 ${video.name} 失败:`, error);
          setVideoFiles(prev => prev.map(v =>
            v.uid === video.uid ? { ...v, status: 'error', error: error.message } : v
          ));
        }

        // 延迟，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
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
    setVideoFiles([]);
    setProgress(0);
    setStatus('');
  };

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      width: 250,
      render: (text: string) => <Text ellipsis={{ showTooltip: true }}>{text}</Text>
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`
    },
    {
      title: '分配账号',
      dataIndex: 'assignedAccount',
      width: 150,
      render: (account: string) => account || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: string) => {
        const statusMap: Record<string, { color: 'grey' | 'blue' | 'cyan' | 'orange' | 'green' | 'red'; text: string }> = {
          pending: { color: 'grey', text: '待处理' },
          uploading: { color: 'blue', text: '上传中' },
          uploaded: { color: 'cyan', text: '已上传' },
          publishing: { color: 'orange', text: '发布中' },
          success: { color: 'green', text: '成功' },
          error: { color: 'red', text: '失败' }
        };
        const { color, text } = statusMap[status] || { color: 'grey', text: '未知' };
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Publish ID',
      dataIndex: 'publishId',
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
        description="批量上传本地视频，自动分配给选中的账号进行发布。视频将按顺序轮流分配给各个账号。"
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space vertical align="start" style={{ width: '100%' }}>
          <div style={{ width: '100%' }}>
            <Text strong>1. 选择账号表</Text>
            <Select
              placeholder="选择包含账号信息的数据表"
              style={{ width: '100%', marginTop: 8 }}
              onChange={(value) => loadAccounts(value as string)}
            >
              {accountTableMetaList?.map(table => (
                <Select.Option key={table.id} value={table.id}>
                  {table.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div style={{ width: '100%' }}>
            <Text strong>2. 选择发布账号（可多选）</Text>
            <Select
              multiple
              placeholder="选择要发布的账号"
              style={{ width: '100%', marginTop: 8 }}
              value={selectedAccountIds}
              onChange={(value) => setSelectedAccountIds(value as string[])}
              disabled={accounts.length === 0}
            >
              {accounts.map(account => (
                <Select.Option key={account.recordId} value={account.recordId}>
                  {account.username} ({account.openId})
                </Select.Option>
              ))}
            </Select>
            {selectedAccountIds.length > 0 && (
              <Text size="small" type="tertiary" style={{ marginTop: 4 }}>
                已选择 {selectedAccountIds.length} 个账号，视频将轮流分配
              </Text>
            )}
          </div>

          <div style={{ width: '100%' }}>
            <Text strong>3. 上传视频文件</Text>
            <Upload
              action=""
              accept="video/*"
              multiple
              beforeUpload={() => false}
              onChange={handleFileChange}
              style={{ marginTop: 8 }}
            >
              <Button icon={<IconUpload />} theme="light">
                选择视频文件（可多选）
              </Button>
            </Upload>
          </div>
        </Space>
      </Card>

      {videoFiles.length > 0 && (
        <Card
          title={`视频列表 (${videoFiles.length})`}
          headerExtraContent={
            <Space>
              <Button
                icon={<IconDelete />}
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
                onClick={handleBatchPublish}
                loading={loading}
                disabled={selectedAccountIds.length === 0}
              >
                开始批量发布
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Table
            columns={columns}
            dataSource={videoFiles}
            pagination={false}
            size="small"
            rowKey="uid"
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
