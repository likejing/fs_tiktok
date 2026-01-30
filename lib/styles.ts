/**
 * 共享样式配置 - 遵循 Base 开放设计规范
 * 
 * 设计规范要点：
 * - 间距遵循 4 的倍数：4px, 8px, 12px, 16px, 20px, 24px
 * - 按钮圆角：4px
 * - 卡片圆角：8px
 * - 按钮间距：12px
 * - 使用 Semi Design CSS 变量适配亮/暗模式
 */

import { CSSProperties } from 'react';

// 容器样式
export const containerStyle: CSSProperties = {
  padding: '0 4px',
};

// 页面标题区域
export const headerStyle: CSSProperties = {
  marginBottom: 16,
};

// 标题样式
export const titleStyle: CSSProperties = {
  marginBottom: 4,
  color: 'var(--semi-color-text-0)',
};

// 卡片样式
export const cardStyle: CSSProperties = {
  marginBottom: 16,
  borderRadius: 8,
};

// 卡片内容样式
export const cardBodyStyle: CSSProperties = {
  padding: '16px 20px',
};

// 区块标题样式
export const sectionTitleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
};

// 按钮组样式
export const buttonGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 20,
};

// 按钮样式
export const buttonStyle: CSSProperties = {
  borderRadius: 4,
};

// 全宽按钮样式
export const fullWidthButtonStyle: CSSProperties = {
  width: '100%',
  borderRadius: 4,
};

// 进度条容器
export const progressContainerStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 8,
};

// 信息卡片样式
export const infoCardStyle: CSSProperties = {
  backgroundColor: 'var(--semi-color-fill-0)',
  borderRadius: 8,
  padding: '12px 16px',
  marginTop: 8,
};

// 字段标签容器
export const fieldListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 8,
};

// 主要字段标签
export const fieldTagStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  backgroundColor: 'var(--semi-color-primary-light-default)',
  color: 'var(--semi-color-primary)',
};

// 次要字段标签
export const fieldTagSecondaryStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  backgroundColor: 'var(--semi-color-warning-light-default)',
  color: 'var(--semi-color-warning)',
};

// 成功字段标签
export const fieldTagSuccessStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  backgroundColor: 'var(--semi-color-success-light-default)',
  color: 'var(--semi-color-success)',
};

// 分隔线样式
export const dividerStyle: CSSProperties = {
  margin: '16px 0',
};

// 说明文字容器
export const descriptionBoxStyle: CSSProperties = {
  backgroundColor: 'var(--semi-color-fill-0)',
  borderRadius: 8,
  padding: '12px 16px',
  marginBottom: 16,
};

// 步骤列表样式
export const stepListStyle: CSSProperties = {
  marginTop: 8,
  paddingLeft: 16,
};

// 步骤项样式
export const stepItemStyle: CSSProperties = {
  marginBottom: 4,
  color: 'var(--semi-color-text-2)',
  fontSize: 13,
  lineHeight: '20px',
};

// 提示信息样式
export const tipStyle: CSSProperties = {
  marginTop: 8,
  padding: '8px 12px',
  borderRadius: 4,
  backgroundColor: 'var(--semi-color-primary-light-default)',
  color: 'var(--semi-color-primary)',
  fontSize: 13,
};

// 警告信息样式
export const warningStyle: CSSProperties = {
  marginTop: 8,
  padding: '8px 12px',
  borderRadius: 4,
  backgroundColor: 'var(--semi-color-warning-light-default)',
  color: 'var(--semi-color-warning)',
  fontSize: 13,
};

// 图标颜色 - 主色
export const iconPrimaryColor = 'var(--semi-color-primary)';

// 图标颜色 - 次要
export const iconSecondaryColor = 'var(--semi-color-text-2)';
