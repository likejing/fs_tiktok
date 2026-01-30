'use client'

import { Tabs, Typography } from '@douyinfe/semi-ui';
import { 
  IconUserGroup, 
  IconVideo, 
  IconComment, 
  IconSend, 
  IconStar, 
  IconLink,
  IconImage
} from '@douyinfe/semi-icons';

import AccountManagement from './components/AccountManagement';
import VideoManagement from './components/VideoManagement';
import CommentManagement from './components/CommentManagement';
import MaterialPublish from './components/MaterialPublish';
import AIGenerate from './components/AIGenerate';
import SocialMediaFetch from './components/SocialMediaFetch';
import NanoGenerate from './components/NanoGenerate';

const { Title, Text } = Typography;

// 主容器样式 - 遵循 Base 开放设计规范
const mainStyle = {
  padding: '16px 12px 12px',
  minHeight: '100vh',
  backgroundColor: 'var(--semi-color-bg-0)',
};

// 标题区域样式
const headerStyle = {
  marginBottom: 16,
  padding: '0 4px',
};

export default function App() {
  return (
    <main style={mainStyle}>
      {/* 页面标题区域 */}
      <div style={headerStyle}>
        <Title 
          heading={5} 
          style={{ 
            marginBottom: 4, 
            color: 'var(--semi-color-text-0)',
            fontWeight: 600,
          }}
        >
          TikTok 运营助手
        </Title>
        <Text type="tertiary" size="small">
          账号管理、视频分析、素材发布、AI生成一站式运营
        </Text>
      </div>

      {/* 标签页导航 */}
      <Tabs 
        type="line" 
        defaultActiveKey="account"
        tabBarStyle={{ 
          padding: '0 4px',
          marginBottom: 16,
        }}
        contentStyle={{
          padding: '0',
        }}
      >
        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconUserGroup size="small" />账号</span>} 
          itemKey="account"
        >
          <AccountManagement />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconVideo size="small" />视频</span>} 
          itemKey="video"
        >
          <VideoManagement />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconComment size="small" />评论</span>} 
          itemKey="comment"
        >
          <CommentManagement />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconSend size="small" />发布</span>} 
          itemKey="material"
        >
          <MaterialPublish />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconStar size="small" />AI</span>} 
          itemKey="ai"
        >
          <AIGenerate />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconImage size="small" />Nano</span>} 
          itemKey="nano"
        >
          <NanoGenerate />
        </Tabs.TabPane>

        <Tabs.TabPane 
          tab={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconLink size="small" />社媒</span>} 
          itemKey="social"
        >
          <SocialMediaFetch />
        </Tabs.TabPane>
      </Tabs>
    </main>
  );
}