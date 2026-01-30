# 隐藏/取消隐藏自有视频的评论

> **API 文档来源**: https://business-api.tiktok.com/portal/docs

您可以使用本接口隐藏或取消隐藏自有 TikTok 账号所发布原生视频的现有评论。

## 注意事项

- 取消隐藏评论可能由于审核操作、用户隐私设置或其他系统层级的过滤机制而不会生效。在这些情况下，评论将保持隐藏状态。要验证评论当前的可见性状态，您可以订阅相关的评论 webhook 事件，或者调用 `/business/comment/list/` 接口获取评论的状态（`status`）。
- 评论 webhook 事件 `comment.update` 使您能够在自有 TikTok 账号下的任一公开视频下原有评论或评论回复被隐藏或取消隐藏的五分钟内收到通知。若想订阅评论 webhook，请查看[订阅评论更新事件](#)。

---

## v1.2 与 v1.3 版本对比

以下表格概括了 v1.2 与 v1.3 接口的变化。

| 变化内容 | v1.2 | v1.3 |
|---------|------|------|
| **接口路径** | `/v1.2/business/comments/hide/` | `/v1.3/business/comment/hide/` |

---

## 请求

### 基本信息

| 属性 | 值 |
|------|-----|
| **地址** | `https://business-api.tiktok.com/open_api/v1.3/business/comment/hide/` |
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
| **comment_id** <br> *必填* | string | Body | 自有 TikTok 视频评论的唯一标识符，隐藏/取消隐藏的对象。可通过 `/business/comment/list/` 接口的 `comment_id` 字段获取所列的各个评论的 ID。 |
| **video_id** <br> *必填* | string | Body | 自有 TikTok 视频的唯一标识符。可通过 `/business/video/list/` 接口的 `item_id` 字段获取。 |
| **action** <br> *必填* | string | Body | 要对评论进行的特定操作 - 隐藏或取消隐藏。<br><br>枚举值：<br>• `HIDE` - 隐藏评论<br>• `UNHIDE` - 取消隐藏评论<br><br>示例：`HIDE` |

---

## 请求示例

```bash
curl --location --request POST 'https://business-api.tiktok.com/open_api/v1.3/business/comment/hide/' \
--header 'Access-Token: {{Access-Token}}' \
--header 'Content-Type: application/json' \
--data '{
    "business_id" : "{{business_id}}",
    "comment_id" : "{{comment_id}}",
    "video_id": "{{video_id}}",
    "action": "HIDE"
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
| `HIDE` | 隐藏 | 将评论设置为隐藏状态，其他用户无法查看 |
| `UNHIDE` | 取消隐藏 | 将评论恢复为公开状态（可能因系统限制而失败） |

---

## 使用场景

### 隐藏不当评论

当发现不适当或违规的评论时：

```json
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}",
  "video_id": "{{video_id}}",
  "action": "HIDE"
}
```

### 恢复误隐藏的评论

当需要恢复之前被误隐藏的评论时：

```json
{
  "business_id": "{{business_id}}",
  "comment_id": "{{comment_id}}",
  "video_id": "{{video_id}}",
  "action": "UNHIDE"
}
```

---

## 评论状态说明

评论的 `status` 字段可能的值：

| 状态 | 描述 |
|------|------|
| `PUBLIC` | 评论公开可见，所有用户都可以查看 |
| `HIDDEN` | 评论已隐藏，仅视频发布者可以查看 |

---

## 取消隐藏可能失败的情况

以下情况可能导致取消隐藏操作不生效：

1. **审核操作**：评论因违反社区准则被平台隐藏
2. **用户隐私设置**：评论发布者的隐私设置限制
3. **系统过滤机制**：自动内容过滤系统标记的评论

---

## 相关接口

| 接口 | 描述 |
|------|------|
| `/business/comment/list/` | 获取自有视频的评论列表（查看 `status` 字段） |
| `/business/comment/delete/` | 删除评论（永久删除） |
| `/business/comment/like/` | 点赞/取消点赞评论 |
| `/business/comment/pin/` | 置顶/取消置顶评论 |
| `/business/video/list/` | 获取视频列表（获取 `item_id`/`video_id`） |
| `/tt_user/oauth2/token/` | 获取访问令牌 |

---

## 与点赞接口的区别

| 对比项 | comment/like | comment/hide |
|--------|-------------|--------------|
| **用途** | 点赞/取消点赞评论 | 隐藏/取消隐藏评论 |
| **必填参数** | `business_id`, `comment_id`, `action` | `business_id`, `comment_id`, `video_id`, `action` |
| **action 枚举值** | `LIKE`, `UNLIKE` | `HIDE`, `UNHIDE` |
| **影响范围** | 仅影响点赞状态 | 影响评论可见性 |

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2026-01-27 | v1.3 | 初始文档创建 |

---

*本文档整理自 TikTok Business API 官方文档，仅供开发参考。*
