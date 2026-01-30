# TikTok Business API 技术文档

> 官方文档地址: https://business-api.tiktok.com/portal/docs

本文件夹包含 TikTok Business API 的技术文档整理，方便开发参考。

---

## 目录结构

```
TikTok-Business-API-Docs/
├── README.md                     # 本文件
├── comments/                     # 评论相关 API
│   ├── comment-list.md           # 获取自有视频的评论
│   ├── comment-reply-list.md     # 获取评论的所有回复
│   ├── comment-create.md         # 为自有视频创建新评论
│   ├── comment-reply-create.md   # 创建对自有视频评论的回复
│   ├── comment-like.md           # 点赞/取消点赞评论
│   ├── comment-hide.md           # 隐藏/取消隐藏评论
│   └── comment-delete.md         # 删除自有评论
└── (更多子文件夹待添加...)
```

---

## 评论相关 API

| 文档 | 描述 | API 版本 |
|------|------|---------|
| [comment-list.md](./comments/comment-list.md) | 获取自有视频的评论 | v1.3 |
| [comment-reply-list.md](./comments/comment-reply-list.md) | 获取评论的所有回复 | v1.3 |
| [comment-create.md](./comments/comment-create.md) | 为自有视频创建新评论 | v1.3 |
| [comment-reply-create.md](./comments/comment-reply-create.md) | 创建对自有视频评论的回复 | v1.3 |
| [comment-like.md](./comments/comment-like.md) | 点赞/取消点赞评论 | v1.3 |
| [comment-hide.md](./comments/comment-hide.md) | 隐藏/取消隐藏评论 | v1.3 |
| [comment-delete.md](./comments/comment-delete.md) | 删除自有评论 | v1.3 |

### 评论 API 概览

| 接口 | 方法 | 端点 | 描述 |
|------|------|------|------|
| 获取评论列表 | GET | `/v1.3/business/comment/list/` | 获取自有视频的所有或指定评论 |
| 获取评论回复列表 | GET | `/v1.3/business/comment/reply/list/` | 获取单条评论的所有回复 |
| 创建评论 | POST | `/v1.3/business/comment/create/` | 为自有视频创建新评论 |
| 创建评论回复 | POST | `/v1.3/business/comment/reply/create/` | 创建对自有视频评论的回复 |
| 点赞/取消点赞评论 | POST | `/v1.3/business/comment/like/` | 点赞或取消点赞自有视频的评论 |
| 隐藏/取消隐藏评论 | POST | `/v1.3/business/comment/hide/` | 隐藏或取消隐藏自有视频的评论 |
| 删除评论 | POST | `/v1.3/business/comment/delete/` | 删除自有视频的自有评论 |

---

## 权限范围 (Scopes)

| Scope | 描述 |
|-------|------|
| `comment.list` | 获取用户视频的评论列表 |
| `comment.list.manage` | 管理用户视频的评论（回复、删除等） |
| `video.list` | 获取视频列表和视频详情 |

---

## 快速参考

### 基础 URL

```
https://business-api.tiktok.com/open_api/
```

### 认证方式

所有 API 请求需要在 Header 中携带 `Access-Token`：

```bash
--header 'Access-Token: {{your_access_token}}'
```

### 获取 Access Token

使用 `/tt_user/oauth2/token/` 接口获取用户授权的访问令牌。

---

## 相关链接

- [TikTok Business API 官方文档](https://business-api.tiktok.com/portal/docs)
- [TikTok for Developers](https://developers.tiktok.com/)
- [TikTok Business API SDK (GitHub)](https://github.com/tiktok/tiktok-business-api-sdk)

---

## 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-01-27 | 创建文档结构，添加评论列表 API 文档 |

---

*本文档仅供开发参考，请以官方文档为准。*
