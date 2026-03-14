# MySQL 数据备份使用指南

## 概述

本项目已集成 MySQL 数据库备份功能，在操作飞书多维表格的同时自动将数据同步到 MySQL，防止数据丢失。该功能对前端完全透明，不影响用户操作。

## 快速开始

### 1. 安装 MySQL

确保已安装 MySQL 5.7+ 或 MariaDB 10.2+

### 2. 创建数据库

执行初始化 SQL 脚本：

```bash
mysql -u root -p < sql/init.sql
```

或手动创建：

```sql
CREATE DATABASE fs_tiktok_backup DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后执行 `sql/init.sql` 中的表结构创建语句。

### 3. 配置环境变量

在 `.env.local` 或 `.env.production` 中配置：

```env
# MySQL 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=fs_tiktok_backup
MYSQL_USER=root
MYSQL_PASSWORD=your_password

# 是否启用数据库备份（可选，默认启用）
ENABLE_DB_BACKUP=true
```

### 4. 启动应用

```bash
npm run dev
```

数据将自动同步到 MySQL！

## 功能特性

### 自动数据同步

以下操作会自动同步到 MySQL：

- ✅ 创建评论 → `comments` 表
- ✅ 刷新 Token → `accounts` 表
- ✅ 发布视频 → `materials` 表
- ✅ 生成 AI 视频 → `ai_materials` 表
- ✅ 获取视频列表 → `videos` 表

### 操作日志

所有数据变更都会记录到 `operation_logs` 表，包括：
- 操作类型（create/update/delete）
- 操作前后的数据
- API 端点
- 用户代理和 IP 地址
- 操作时间

### 数据恢复

可以从 MySQL 恢复数据到飞书多维表格（功能待实现）。

## 在 API 中集成数据同步

### 示例：创建评论

```typescript
import { syncComment, logOperation } from '../../lib/dbSync'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ... 调用 TikTok API ...

  // 同步数据到 MySQL（异步，不阻塞主流程）
  if (data.code === 0 && data.data) {
    syncComment({
      commentId: data.data.comment_id,
      videoId: video_id,
      openId: business_id,
      text: text,
      createTime: data.data.create_time,
      status: 'active',
    }).catch(err => console.error('同步失败:', err));

    // 记录操作日志
    logOperation({
      tableName: 'comments',
      recordId: data.data.comment_id,
      operation: 'create',
      dataAfter: { ... },
      apiEndpoint: '/api/createTkComment',
    }).catch(err => console.error('记录日志失败:', err));
  }

  res.status(200).json(data)
}
```

### 可用的同步函数

```typescript
// 同步账号数据
syncAccount(data: AccountData): Promise<void>

// 同步视频数据
syncVideo(data: VideoData): Promise<void>

// 同步素材数据
syncMaterial(data: MaterialData): Promise<void>

// 同步AI素材数据
syncAIMaterial(data: AIMaterialData): Promise<void>

// 同步评论数据
syncComment(data: CommentData): Promise<void>

// 记录操作日志
logOperation(data: OperationLogData): Promise<void>
```

## 数据库表结构

### accounts - 账号表
存储 TikTok 账号信息和 Token

### videos - 视频列表
存储视频基本信息和统计数据

### materials - 素材库
存储待发布和已发布的素材

### ai_materials - AI素材生成
存储 AI 视频生成任务和结果

### comments - 评论记录
存储评论内容和状态

### operation_logs - 操作日志
记录所有数据变更操作

详细表结构见 `docs/DATABASE_BACKUP.md`

## 禁用数据库备份

如果不需要数据库备份功能，可以在环境变量中设置：

```env
ENABLE_DB_BACKUP=false
```

或者不配置 MySQL 相关环境变量。

## 注意事项

1. **性能影响**：数据同步是异步的，不会阻塞主流程
2. **失败处理**：同步失败不会影响主功能，只会记录错误日志
3. **敏感数据**：Token 等敏感信息会存储到数据库，请确保数据库安全
4. **定期清理**：建议定期清理 `operation_logs` 表中的旧数据

## 监控和维护

### 检查同步状态

```sql
-- 查看最近的操作日志
SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT 100;

-- 查看各表的记录数
SELECT
  (SELECT COUNT(*) FROM accounts) as accounts_count,
  (SELECT COUNT(*) FROM videos) as videos_count,
  (SELECT COUNT(*) FROM materials) as materials_count,
  (SELECT COUNT(*) FROM ai_materials) as ai_materials_count,
  (SELECT COUNT(*) FROM comments) as comments_count;
```

### 清理旧日志

```sql
-- 删除30天前的操作日志
DELETE FROM operation_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## 故障排查

### 连接失败

检查 MySQL 配置和网络连接：

```bash
mysql -h localhost -u root -p -e "SELECT 1"
```

### 同步失败

查看应用日志中的错误信息：

```
❌ Failed to sync comment: Error: ...
```

检查数据库权限和表结构是否正确。

## 未来计划

- [ ] 数据恢复功能
- [ ] 定时全量同步
- [ ] 数据一致性检查
- [ ] 监控面板
- [ ] 数据导出功能

## 技术支持

如有问题，请查看：
- 数据库设计文档：`docs/DATABASE_BACKUP.md`
- 初始化脚本：`sql/init.sql`
- 同步工具代码：`lib/dbSync.ts`
