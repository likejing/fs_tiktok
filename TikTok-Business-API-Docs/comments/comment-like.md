# 点赞/取消点赞自有视频的评论

> **API 文档来源**: https://business-api.tiktok.com/portal/docs

您可以使用本接口点赞或取消点赞自有 TikTok 账号所发布原生视频的某条现有评论。

---

## v1.2 与 v1.3 版本对比

以下表格概括了 v1.2 与 v1.3 接口的变化。

| 变化内容 | v1.2 | v1.3 |
|---------|------|------|
| **接口路径** | `/v1.2/business/comments/like/` | `/v1.3/business/comment/like/` |

---

## 请求

### 基本信息

| 属性 | 值 |
|------|-----|
| **地址** | `https://business-api.tiktok.com/open_api/v1.3/business/comment/like/` |
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
| **comment_id** <br> *必填* | string | Body | 自有 TikTok 视频评论的唯一标识符，点赞或取消点赞的对象。可通过 `/business/comment/list/` 接口的 `comment_id` 字段获取所列的各个评论的 ID。 |
| **action** <br> *必填* | string | Body | 要对评论进行的特定操作 - 点赞或取消点赞。<br><br>枚举值：<br>• `LIKE` - 点赞评论<br>• `UNLIKE` - 取消点赞评论<br><br>示例：`LIKE` |

---

## 请求示例

```bash
curl -L -X POST 'https://business-api.tiktok.com/open_api/v1.3/business/comment/like/' \
-H 'Content-Type: application/json' \
-H 'Access-Token: 1234a16d2e08c3f17d1984a1be07d00406p3LIAF7vEpxliox8GRpCINv70x' \
--data-raw '{
  "business_id" : "b3d2f73d-4b8c-47fb-85c3-cd571287754b",
  "comment_id" : "b3d2f73d-4b8c-47fb-85c3-cd571287754b",
  "action": "like"
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

## action 枚举值说明

| 值 | 描述 | 效果 |
|----|------|------|
| `LIKE` | 点赞 | 为指定评论添加点赞 |
| `UNLIKE` | 取消点赞 | 移除对指定评论的点赞 |

---

## 使用场景

### 点赞评论

当您想对某条用户评论表示认可时：

```json
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}",
  "action": "LIKE"
}
```

### 取消点赞评论

当您想撤销之前的点赞时：

```json
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}",
  "action": "UNLIKE"
}
```

---

## 相关接口

| 接口 | 描述 |
|------|------|
| `/business/comment/list/` | 获取自有视频的评论列表（获取 `comment_id`） |
| `/business/comment/pin/` | 置顶/取消置顶评论 |
| `/business/comment/delete/` | 删除评论 |
| `/tt_user/oauth2/token/` | 获取访问令牌 |

---

## 注意事项

- 只能对自有视频的评论进行点赞/取消点赞操作
- 重复点赞同一条评论不会产生错误，但不会重复计数
- 对未点赞的评论执行取消点赞操作不会产生错误

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2026-01-27 | v1.3 | 初始文档创建 |

---

*本文档整理自 TikTok Business API 官方文档，仅供开发参考。*
