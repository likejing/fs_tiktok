# 删除自有视频的评论

> **API 文档来源**: https://business-api.tiktok.com/portal/docs

您可以使用本接口删除自有 TikTok 账号所发布原生视频的自有评论。

## 注意事项

- **其他用户的评论不能被删除**，只能通过 `/business/comment/hide/` 接口进行隐藏。
- 评论 webhook 事件 `comment.update` 使您能够在自有 TikTok 账号下的任一公开视频下原有评论或评论回复被删除的五分钟内收到通知。若想订阅评论 webhook，请查看[订阅评论更新事件](#)。

---

## v1.2 与 v1.3 版本对比

以下表格概括了 v1.2 与 v1.3 接口的变化。

| 变化内容 | v1.2 | v1.3 |
|---------|------|------|
| **接口路径** | `/v1.2/business/comments/delete/` | `/v1.3/business/comment/delete/` |

---

## 请求

### 基本信息

| 属性 | 值 |
|------|-----|
| **地址** | `https://business-api.tiktok.com/open_api/v1.3/business/comment/delete/` |
| **方法** | POST |

### Header

| 字段 | 类型 | 描述 |
|------|------|------|
| **Access-Token** <br> *必填* | string | 经 TikTok 创作者授权的访问令牌。<br>若想获取访问令牌，需使用 `/tt_user/oauth2/token/` 接口。 |
| **Content-Type** <br> *必填* | string | 请求信息类型。<br>允许格式：`application/json`。 |

### 参数

请将下列参数放在请求体（Body）中以 JSON 格式传递。

| 字段 | 类型 | 参数位置 | 描述 |
|------|------|---------|------|
| **business_id** <br> *必填* | string | Body | TikTok 账户的应用唯一识别ID。<br>您需将 `/tt_user/oauth2/token/` 接口返回的 `open_id` 字段值传给本字段。 |
| **comment_id** <br> *必填* | string | Body | 自有 TikTok 视频自有评论的唯一标识符，删除的对象。可通过 `/business/comment/list/` 接口的 `comment_id` 字段获取所列的各个评论的 ID。 |

---

## 请求示例

```bash
curl -L -X POST 'https://business-api.tiktok.com/open_api/v1.3/business/comment/delete/' \
-H 'Content-Type: application/json' \
-H 'Access-Token: 1234a16d2e08c3f17d1984a1be07d00406p3LIAF7vEpxliox8GRpCINv70x' \
--data-raw '{
  "business_id": "b3d2f73d-4b8c-47fb-85c3-cd571287754b",
  "comment_id": "b3d2f73d-4b8c-47fb-85c3-cd571287754b"
}'
```

---

## 返回

### Header

这些 header 很重要，可用于记录问题报告和故障排查信息。下表列出了部分返回的 header。

| 字段 | 类型 | 描述 |
|------|------|------|
| **Date** | string | 收到返回时的(GMT)日期和时间。<br>示例：`Fri, 13 Aug 2021 08:04:42 GMT` |
| **X-Tt-Logid** | string | 接口请求的唯一标识符。 |

### Body

| 字段 | 类型 | 描述 |
|------|------|------|
| **request_id** | string | 接口请求的唯一标识符。<br><br>请记录此字段，用于所有接口请求。此字段对于问题报告和故障排查十分重要。 |
| **code** | integer | 返回码。完整返回码列表及描述，可查看附录 - 返回码。 |
| **message** | string | 返回信息。更多信息可查看附录 - 返回码。 |
| **data** | object | 返回数据。<br>操作成功时返回空对象：`{}`。 |

---

## 返回示例

```http
HTTPS/1.1 200 OK
```

```json
{
  "code": 0,
  "message": "Ok",
  "request_id": "20210817034316010245031056097316BA",
  "data": {}
}
```

---

## 删除与隐藏的区别

| 对比项 | 删除 (delete) | 隐藏 (hide) |
|--------|--------------|-------------|
| **适用对象** | 仅限自有评论 | 所有评论（包括他人评论） |
| **操作效果** | 永久删除，不可恢复 | 可恢复（取消隐藏） |
| **其他用户评论** | ❌ 不支持 | ✅ 支持 |
| **推荐场景** | 删除自己发布的评论 | 管理不当评论 |

---

## 使用场景

### 删除自己发布的评论

当您想删除自己在视频下发布的评论时：

```json
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}"
}
```

### 无法删除他人评论

如果尝试删除他人评论，将会收到错误响应。对于他人评论，请使用隐藏接口：

```bash
# 使用隐藏接口代替
POST /v1.3/business/comment/hide/
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}",
  "video_id": "{{video_id}}",
  "action": "HIDE"
}
```

---

## 相关接口

| 接口 | 描述 |
|------|------|
| `/business/comment/list/` | 获取自有视频的评论列表（获取 `comment_id`，检查 `owner` 字段确认是否为自有评论） |
| `/business/comment/hide/` | 隐藏/取消隐藏评论（适用于他人评论） |
| `/business/comment/like/` | 点赞/取消点赞评论 |
| `/tt_user/oauth2/token/` | 获取访问令牌 |

---

## 如何判断评论是否可删除

在调用删除接口前，可以通过 `/business/comment/list/` 返回的 `owner` 字段判断评论是否为自有评论：

| owner 值 | 描述 | 是否可删除 |
|----------|------|-----------|
| `true` | 评论由视频发布者（自己）创建 | ✅ 可删除 |
| `false` | 评论由其他用户创建 | ❌ 不可删除（只能隐藏） |

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2026-01-27 | v1.3 | 初始文档创建 |

---

*本文档整理自 TikTok Business API 官方文档，仅供开发参考。*
