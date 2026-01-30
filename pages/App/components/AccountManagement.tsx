'use client'
import { bitable, ITableMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Input, Toast, Typography, Space, Card, Divider, Banner } from '@douyinfe/semi-ui';
import { IconUserAdd, IconRefresh, IconCopy, IconExternalOpen } from '@douyinfe/semi-icons';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { TIKTOK_AUTH_URL, TIKTOK_USER_INFO_API } from '../../../lib/constants';
import { 
  getFieldStringValue, 
  getFieldTypeByValue, 
  convertValueByFieldType,
  findOrCreateField 
} from '../../../lib/fieldUtils';
import { findRecordByOpenId } from '../../../lib/recordUtils';

const { Title, Text } = Typography;

// 账号字段名映射：API返回的字段名 -> 表格中的中文字段名
const ACCOUNT_FIELD_MAPPING: Record<string, string> = {
  'username': '用户名',
  'display_name': '账号展示名',
  'profile_image': '头像链接',
  'followers_count': '粉丝数',
  'total_likes': '获赞数',
  'videos_count': '视频数',
  'following_count': '关注数',
};

export default function AccountManagement() {
  const [tableMetaList, setTableMetaList] = useState<ITableMeta[]>();
  const [jsonData, setJsonData] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const formApi = useRef<BaseFormApi>();

  // 复制TikTok授权链接
  const handleCopyAuthLink = useCallback(async () => {
    try {
      // 方法1: 尝试使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(TIKTOK_AUTH_URL);
          Toast.success('TikTok授权链接已复制到剪贴板！');
          return;
        } catch (clipboardError) {
          console.warn('Clipboard API 失败，尝试降级方案:', clipboardError);
        }
      }

      // 方法2: 使用传统方法（execCommand）
      const textArea = document.createElement('textarea');
      textArea.value = TIKTOK_AUTH_URL;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('aria-hidden', 'true');
      
      document.body.appendChild(textArea);
      
      // 兼容不同浏览器
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        // iOS 设备特殊处理
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.select();
        textArea.setSelectionRange(0, 999999);
      }
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          Toast.success('TikTok授权链接已复制到剪贴板！');
        } else {
          throw new Error('execCommand 返回 false');
        }
      } catch (err) {
        console.error('execCommand 复制失败:', err);
        // 如果复制失败，选中输入框中的文本，让用户手动复制
        Toast.warning('自动复制失败，请手动选择下方链接进行复制');
        // 触发输入框的选中事件（如果存在）
        const linkInput = document.getElementById('tiktok-auth-link-input') as HTMLInputElement;
        if (linkInput) {
          linkInput.focus();
          linkInput.select();
        }
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('复制失败:', err);
      Toast.warning('自动复制失败，请手动选择下方链接进行复制');
      // 选中输入框中的文本
      const linkInput = document.getElementById('tiktok-auth-link-input') as HTMLInputElement;
      if (linkInput) {
        linkInput.focus();
        linkInput.select();
      }
    }
  }, []);

  // 在新窗口打开授权链接
  const handleOpenAuthLink = useCallback(() => {
    window.open(TIKTOK_AUTH_URL, '_blank');
  }, []);

  // 将JSON数据写入表格（新增或更新账号）
  const handleSaveData = useCallback(async ({ table: tableId, jsonData: data }: { table: string; jsonData: string }) => {
    if (!tableId) {
      Toast.error('请先选择账号列表');
      return;
    }

    if (!data || !data.trim()) {
      Toast.error('请输入JSON数据');
      return;
    }

    setLoading(true);
    try {
      // 解析JSON数据
      let parsedData: any;
      try {
        parsedData = JSON.parse(data.trim());
      } catch (e) {
        Toast.error('JSON格式错误，请检查数据格式');
        setLoading(false);
        return;
      }

      const table = await bitable.base.getTableById(tableId);
      let fieldList = await table.getFieldList();
      
      // 提取data对象中的数据
      let dataToSave: Record<string, any> = {};
      
      if (parsedData && typeof parsedData === 'object') {
        if (parsedData.data && typeof parsedData.data === 'object') {
          dataToSave = parsedData.data;
        } else {
          dataToSave = parsedData;
        }
      } else {
        Toast.error('JSON数据格式不正确，未找到data对象');
        setLoading(false);
        return;
      }

      // 检查是否有open_id字段
      if (!dataToSave.open_id) {
        Toast.error('JSON数据中未找到open_id字段，无法判断账号是否已存在');
        setLoading(false);
        return;
      }

      // 确保open_id字段存在
      let openIdField = await findOrCreateField(table, fieldList, 'open_id', FieldType.Text);
      if (!openIdField) {
        Toast.error('无法创建或获取open_id字段，无法判断账号是否已存在');
        setLoading(false);
        return;
      }
      fieldList = await table.getFieldList(); // 更新字段列表

      // 准备要写入的字段数据
      const fields: Record<string, any> = {};
      
      // 遍历data对象中的每个字段，保存到对应的表格字段
      for (const [key, value] of Object.entries(dataToSave)) {
        try {
          // 如果是open_id字段，直接使用之前已创建的字段
          if (key === 'open_id' && openIdField) {
            const fieldValue = String(value);
            fields[openIdField.id] = fieldValue;
            console.log(`字段 ${key} (${openIdField.id}) 保存值:`, fieldValue);
            continue;
          }
          
          // 使用字段名映射：如果API返回的字段名在映射表中，使用映射后的中文字段名
          const fieldName = ACCOUNT_FIELD_MAPPING[key] || key;
          
          // 查找或创建字段
          let field = await findOrCreateField(
            table, 
            fieldList, 
            fieldName, 
            getFieldTypeByValue(value)
          );
          
          if (!field) {
            console.warn(`字段 ${key} -> ${fieldName} 不存在且创建失败，跳过`);
            continue;
          }
          
          // 转换值
          const fieldValue = await convertValueByFieldType(field, value);
          
          if (fieldValue !== null && fieldValue !== undefined) {
            fields[field.id] = fieldValue;
            console.log(`字段 ${key} -> ${fieldName} (${field.id}) 保存值:`, fieldValue);
          }
        } catch (e) {
          console.error(`处理字段 ${key} 时出错:`, e);
          Toast.error(`处理字段 ${key} 时出错: ${e}`);
        }
      }
      
      if (Object.keys(fields).length === 0) {
        Toast.warning(`未找到可保存的字段。已解析的字段: ${Object.keys(dataToSave).join(', ')}`);
        setLoading(false);
        return;
      }
      
      console.log('准备保存的字段数据:', fields);

      // 查找是否存在相同open_id的记录
      const openIdValue = dataToSave.open_id;
      const existingRecordId = await findRecordByOpenId(table, openIdField, openIdValue);

      // 根据是否存在记录决定新增或更新
      if (existingRecordId) {
        await table.setRecord(existingRecordId, { fields });
        Toast.success(`账号已更新！open_id: ${openIdValue}`);
      } else {
        await table.addRecord({ fields });
        Toast.success(`新账号已添加！open_id: ${openIdValue}`);
      }

      setJsonData('');
      formApi.current?.setValue('jsonData', '');
    } catch (error: any) {
      console.error('保存数据失败:', error);
      Toast.error(`保存失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新所有账号信息
  const handleUpdateAccountInfo = useCallback(async () => {
    setUpdating(true);
    try {
      const table = await bitable.base.getActiveTable();
      if (!table) {
        Toast.error('请先选择账号列表');
        setUpdating(false);
        return;
      }
      
      let fieldList = await table.getFieldList();
      
      // 查找 access_token 和 open_id 字段
      let accessTokenField = fieldList.find((f: any) => f.name === 'access_token');
      let openIdField = fieldList.find((f: any) => f.name === 'open_id');
      
      // 如果字段不存在，尝试获取
      if (!accessTokenField) {
        try {
          accessTokenField = await table.getFieldByName('access_token');
        } catch (e) {
          console.warn('access_token字段不存在');
        }
      }
      
      if (!openIdField) {
        try {
          openIdField = await table.getFieldByName('open_id');
        } catch (e) {
          console.warn('open_id字段不存在');
        }
      }

      // 必须同时存在 access_token 和 open_id 字段
      if (!accessTokenField) {
        Toast.error('表格中未找到 access_token 字段，无法更新账号信息');
        setUpdating(false);
        return;
      }

      if (!openIdField) {
        Toast.error('表格中未找到 open_id 字段，无法更新账号信息');
        setUpdating(false);
        return;
      }

      // 辅助函数：更新单条记录
      const updateSingleRecord = async (recordId: string, accessToken: string | null, openId: string | null) => {
        if (!accessToken || !openId) {
          return false;
        }

        const apiUrl = `${TIKTOK_USER_INFO_API}?access_token=${encodeURIComponent(accessToken)}&open_id=${encodeURIComponent(openId)}`;
        console.log(`请求账号信息，URL: ${apiUrl.replace(/access_token=[^&]+/, 'access_token=***')}`);

        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`请求失败: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();

        if (result.code !== 0 && result.error) {
          throw new Error(result.error + (result.details ? `: ${result.details}` : ''));
        }

        if (!result.data) {
          throw new Error('接口返回数据格式错误，未找到data字段');
        }

        const userInfo = result.data;
        const fields: Record<string, any> = {};
        
        // 遍历用户信息中的每个字段，更新到表格
        for (const [key, value] of Object.entries(userInfo)) {
          try {
            // 使用字段名映射：如果API返回的字段名在映射表中，使用映射后的中文字段名
            const fieldName = ACCOUNT_FIELD_MAPPING[key] || key;
            
            let field = await findOrCreateField(
              table,
              fieldList,
              fieldName,
              getFieldTypeByValue(value)
            );
            
            if (!field) {
              console.warn(`字段 ${key} -> ${fieldName} 不存在且创建失败，跳过`);
              continue;
            }
            
            const fieldValue = await convertValueByFieldType(field, value);
            
            if (fieldValue !== null && fieldValue !== undefined) {
              fields[field.id] = fieldValue;
              console.log(`字段 ${key} -> ${fieldName} (${field.id}) 更新值:`, fieldValue);
            }
          } catch (e) {
            console.error(`处理字段 ${key} 时出错:`, e);
          }
        }
        
        if (Object.keys(fields).length > 0) {
          await table.setRecord(recordId, { fields });
          return true;
        }
        return false;
      };

      // 获取所有记录
      Toast.info('开始更新所有账号信息，请稍候...');
      const records = await table.getRecords({ pageSize: 5000 });

      const totalRecords = records.records.length;
      console.log(`开始更新 ${totalRecords} 条记录`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      // 逐条处理记录
      for (let i = 0; i < records.records.length; i++) {
        const record = records.records[i];
        const recordId = record.recordId;
        
        try {
          let accessToken: string | null = null;
          let openId: string | null = null;
          
          if (accessTokenField) {
            accessToken = await getFieldStringValue(table, accessTokenField, recordId);
          }
          
          if (openIdField) {
            openId = await getFieldStringValue(table, openIdField, recordId);
          }

          // 必须同时有 access_token 和 open_id
          if (!accessToken || !openId) {
            const missingFields = [];
            if (!accessToken) missingFields.push('access_token');
            if (!openId) missingFields.push('open_id');
            console.log(`记录 ${i + 1}/${totalRecords} (${recordId}) 缺少 ${missingFields.join(' 和 ')}，跳过`);
            skipCount++;
            continue;
          }

          console.log(`更新记录 ${i + 1}/${totalRecords} (${recordId})...`);
          
          const updated = await updateSingleRecord(recordId, accessToken, openId);
          
          if (updated) {
            successCount++;
            console.log(`✅ 记录 ${i + 1}/${totalRecords} 更新成功`);
          } else {
            skipCount++;
          }

          // 每更新10条记录显示一次进度
          if ((i + 1) % 10 === 0) {
            Toast.info(`已更新 ${i + 1}/${totalRecords} 条记录...`);
          }
        } catch (error: any) {
          errorCount++;
          console.error(`更新记录 ${i + 1}/${totalRecords} (${recordId}) 失败:`, error);
        }
      }

      // 显示最终结果
      const message = `更新完成！成功: ${successCount}，跳过: ${skipCount}，失败: ${errorCount}`;
      if (errorCount === 0) {
        Toast.success(message);
      } else {
        Toast.warning(message);
      }
      
      console.log(`更新完成 - 总计: ${totalRecords}, 成功: ${successCount}, 跳过: ${skipCount}, 失败: ${errorCount}`);
    } catch (error: any) {
      console.error('更新账号信息失败:', error);
      Toast.error(`更新失败: ${error.message || '未知错误'}`);
    } finally {
      setUpdating(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()])
      .then(([metaList, selection]) => {
        setTableMetaList(metaList);
        
        // 根据表名查找并默认选中
        const accountTableId = metaList.find(table => table.name === '账号列表')?.id || selection.tableId;
        
        formApi.current?.setValues({ table: accountTableId });
      });
  }, []);

  // 样式常量 - 遵循 Base 开放设计规范
  const styles = {
    container: { padding: '0 4px' },
    header: { marginBottom: 16 },
    card: { marginBottom: 16, borderRadius: 8 },
    cardBody: { padding: '16px 20px' },
    sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    buttonGroup: { display: 'flex', gap: 12, marginTop: 16 },
    infoCard: { backgroundColor: 'var(--semi-color-fill-0)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 },
    stepItem: { marginBottom: 4, color: 'var(--semi-color-text-2)', fontSize: 13, lineHeight: '20px' },
  };

  return (
    <div style={styles.container}>
      {/* 页面标题 */}
      <div style={styles.header}>
        <Title heading={5} style={{ marginBottom: 4, color: 'var(--semi-color-text-0)' }}>
          账号管理
        </Title>
        <Text type="tertiary" size="small">
          授权绑定 TikTok 账号，同步账号数据
        </Text>
      </div>

      {/* 新增账号卡片 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <div style={styles.sectionTitle}>
          <IconUserAdd style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>新增账号</Text>
        </div>

        {/* 操作步骤说明 */}
        <div style={styles.infoCard}>
          <Text size="small" style={{ color: 'var(--semi-color-text-1)', fontWeight: 500 }}>操作步骤</Text>
          <div style={{ marginTop: 8 }}>
            <div style={styles.stepItem}>1. 复制授权链接，在浏览器中打开</div>
            <div style={styles.stepItem}>2. 使用 TikTok 账号完成授权</div>
            <div style={styles.stepItem}>3. 将返回的 JSON 数据粘贴到下方</div>
            <div style={styles.stepItem}>4. 选择账号列表，点击新增</div>
          </div>
        </div>

        <Form 
          labelPosition='top' 
          onSubmit={handleSaveData} 
          getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}
        >
          {/* 授权链接 */}
          <div style={{ marginBottom: 16 }}>
            <Text size="small" style={{ color: 'var(--semi-color-text-1)', marginBottom: 8, display: 'block' }}>
              授权链接
            </Text>
            <Input
              id="tiktok-auth-link-input"
              value={TIKTOK_AUTH_URL}
              readOnly
              style={{ width: '100%', marginBottom: 8 }}
              onFocus={(e) => e.target.select()}
            />
            <div style={styles.buttonGroup}>
              <Button 
                icon={<IconCopy />}
                onClick={handleCopyAuthLink}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                复制链接
              </Button>
              <Button 
                icon={<IconExternalOpen />}
                onClick={handleOpenAuthLink}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                打开链接
              </Button>
            </div>
          </div>

          <Form.Select 
            field='table' 
            label='账号列表'
            placeholder="选择保存账号的数据表" 
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请选择账号列表' }]}
            optionList={tableMetaList?.map(({ name, id }) => ({ label: name, value: id }))}
          />

          <Form.TextArea
            field='jsonData'
            label='授权返回数据'
            placeholder='粘贴授权完成后返回的 JSON 数据...'
            rows={6}
            style={{ width: '100%' }}
            rules={[{ required: true, message: '请输入JSON数据' }]}
          />

          <Button 
            htmlType='submit' 
            loading={loading}
            icon={<IconUserAdd />}
            className="btn-primary"
            style={{ width: '100%', marginTop: 8 }}
          >
            新增账号
          </Button>
        </Form>
      </Card>

      {/* 更新账号卡片 */}
      <Card style={styles.card} bodyStyle={styles.cardBody} bordered={false} shadows='hover'>
        <div style={styles.sectionTitle}>
          <IconRefresh style={{ color: 'var(--semi-color-primary)' }} />
          <Text strong style={{ color: 'var(--semi-color-text-0)' }}>批量更新</Text>
        </div>

        <div style={styles.infoCard}>
          <Text type="tertiary" size="small">
            同步账号列表中所有 TikTok 账号的最新数据，包括粉丝数、获赞数、视频数等
          </Text>
        </div>

        <Button 
          onClick={handleUpdateAccountInfo}
          loading={updating}
          icon={<IconRefresh />}
          className="btn-tertiary"
          style={{ width: '100%' }}
        >
          更新所有账号
        </Button>
      </Card>

      {/* 提示信息 */}
      <Banner 
        type="info"
        description="系统会自动解析 JSON 并保存账号。已存在的账号会自动更新，字段会自动创建。"
        style={{ borderRadius: 8 }}
      />
    </div>
  );
}

