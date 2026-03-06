# TikTok Business API 技术文档

## 引言

本技术文档旨在全面介绍 TikTok Business API 的核心功能、授权流程、认证机制以及各种 API 端点的使用方法。通过本文档，开发者可以系统地了解如何利用 TikTok Business API 来管理账户、发布内容、审核评论以及获取数据洞察，从而更高效地进行应用开发和业务集成。

# Overview

## 概述

**Business Account** 是 TikTok 为企业用户设计的一种独特账户类型，提供了一套扩展功能来服务于企业的推广和商业需求。详细介绍请参见 TikTok Business Help Center 上的 [About TikTok Business Account](https://business-help.tiktok.com/)。

**Personal Account** 是 TikTok 为普通用户设计的账户类型。详细介绍请参阅 [Personal and Business Accounts on TikTok-Personal Accounts](https://support.tiktok.com/en/using-tiktok/growing-your-audience/personal-account-vs-business-account) 部分。

TikTok 的 Accounts API 是由 API 为业务团队提供给开发者的三个接口服务系列。通过集成和调用 Accounts API，开发者可以利用我们的接口与 **TikTok Business Account** 和 TikTok Personal Accounts 进行交互，包括拉取 Reporting / Insights、Comment Moderation 以及 Video Publishing（针对 Business Account 或 Personal Account）。

## Accounts API

Accounts API 包含三个主要模块：

1. **Accounts Insights（账户洞察）**
   - 使拥有 Business Accounts 或 Personal Accounts 的广告主能够访问其关注者基础和视频互动的详细分析和洞察

2. **Accounts Moderation（账户审核）**
   - 允许从 Business Account 视频或 Personal Account 视频中查看、回复和删除评论

3. **Accounts Video Publishing（账户视频发布）**
   - 允许将视频内容上传和发布到 Business Account 或 Personal Account

# Authorization

## 概述

在使用 Accounts API 之前，开发者需要首先获得企业的授权来管理其账户。

## Prerequisites（前提条件）

在开始授权流程之前，需要满足以下条件：

1. **创建 TikTok For Business 账户**：您需要创建一个 TikTok For Business 账户。详情请参见 [Create a TikTok For Business account](https://business-help.tiktok.com/)。

2. **注册为开发者**：您需要注册为开发者。详情请参见 [Register as developer](https://developers.tiktok.com/)。

3. **创建开发者应用**：您需要创建一个具有所需权限范围的开发者应用，该应用需要包含 "TikTok Accounts" 权限以访问 Accounts API 端点。详情请参见 [Create developer app](https://developers.tiktok.com/)。

## Steps（授权步骤）

### 步骤 1：分享授权 URL

开发者需要与 TikTok 账户用户分享授权 URL。该 URL 可以通过以下路径找到：

**My Apps** > **App Detail** > **Basic Information** > **TikTok account holder authorization URL**

#### 注意事项

默认情况下，如果 TikTok 账户用户之前已经为相同的权限授权过该开发者应用，则步骤 2 中的权限范围审查和批准页面将被跳过。相反，TikTok 账户用户将直接重定向到重定向 URL。

**如果需要禁用 TikTok 账户用户的自动重定向机制**，开发者需要在与 TikTok 账户用户分享 URL 之前，手动将 `&disable_auto_auth=1` 参数附加到 TikTok 账户持有者授权 URL。

# Get Started

## 欢迎使用 TikTok Accounts API

TikTok Accounts API 的设计理念是让开发者能够轻松访问和使用。只需几个简单的步骤即可获得访问权限并开始管理您的 TikTok 账户。

## 分步工作流程

在进行第一次 API 调用之前，需要完成以下步骤：

1. **创建 TikTok For Business 账户**
2. **注册为开发者**
3. **创建开发者应用**
4. **授权（Authorization）**
5. **认证（Authentication）**
6. **进行首次 API 调用**：可以使用 TikTok API for Business Postman collection 轻松测试集成，而无需影响真实的 TikTok 账户

## API 端点

要了解可用的端点信息，请参阅 API Reference。

## 速率限制

要了解 Accounts API 的速率限制，请参阅速率限制文档。

## 错误代码

API 返回标准的 HTTP 状态码和错误信息，帮助开发者快速定位和解决问题。

# Authentication

## 概述

在 TikTok 账户用户授权后，您将收到授权码（authorization code）。使用该授权码，您可以向以下端点发起请求，获取 TikTok 账户访问令牌（access token）以用于后续的 API 请求，同时还会获得用于访问令牌更新的刷新令牌（refresh token）。

要获取 TikTok 账户用户授权的权限范围，可以将生成的访问令牌传递给 `/tt_user/token_info/get/` 端点。

## Access Token Expiry（访问令牌过期时间）

**TikTok 账户访问令牌的有效期为一天**。一旦 TikTok 账户访问令牌过期，您需要向相应端点发起请求以更新访问令牌。请记住在令牌更新请求中传递 `refresh_token` 参数。

## Refresh Token Expiry（刷新令牌过期时间）

**TikTok 账户刷新令牌的有效期为一年**。如果刷新令牌过期，开发者需要通过用户授权工作流程请求用户重新授权其应用程序。

## Authentication（认证方法）

### 获取或更新访问令牌

- **获取访问令牌**：使用 `/tt_user/oauth2/token/` 端点
- **更新访问令牌**：使用 `/tt_user/oauth2/refresh_token/` 端点

这两个端点都需要 `redirect_uri` 参数以提高安全性。

### 撤销访问令牌

要撤销 TikTok 账户访问令牌，使用 `/tt_user/oauth2/revoke/` 端点。

## 主要 API 端点

1. **获取 TikTok 账户访问令牌**：`/tt_user/oauth2/token/`
2. **更新 TikTok 账户访问令牌**：`/tt_user/oauth2/refresh_token/`
3. **撤销 TikTok 账户访问令牌**：`/tt_user/oauth2/revoke/`
4. **获取令牌信息**：`/tt_user/token_info/get/`

# Rate Limits

## 概述

每个授权的 TikTok 账户和 Accounts API 端点的速率限制为 **每分钟 40 次查询（QPM）**。

此外，所有 Accounts API 端点组合还有一个单独的速率限制，该限制由分配给开发者应用程序的全局速率限制级别决定。

## 全局速率限制级别

下表概述了基于全局速率限制级别的 Accounts API 端点组合的速率限制：

| 全局速率限制级别 | 所有 Accounts API 端点的 QPM |
|-----------------|---------------------------|
| Basic           | 600                       |
| Advanced        | 1,000                     |
| Premium         | 1,000                     |
| Ultimate        | 1,000                     |

## 注意事项

要了解有关全局速率限制和速率限制级别的更多信息，请参阅 Rate limits 文档。

# Manage URL Properties

## 概述

验证视频 URL 的所有权是遵守 TikTok 关于版权内容和用户安全政策的重要步骤。本指南将引导您完成添加和验证 URL 属性的过程，以便您可以成功地将公共视频发布到您拥有的 TikTok 账户。

## 重要说明

在调用 `/business/video/publish/` 端点之前，必须验证您计划传递给 `video_url` 参数的视频 URL 是否来自已拥有并验证的 URL 属性。这意味着您需要有一个可以上传和托管视频的网站或其他在线平台，然后在发布视频时向 TikTok 提供该视频的 URL。

### 关键政策变更

- **自 2023 年 11 月 16 日起**，您无法再使用未经验证的视频 URL 发布视频。为确保顺利的 API 集成，建议您尽快验证 URL 属性的所有权。

- **2023 年 11 月 16 日之后**，如果您想通过 `/business/video/publish/` 发布测试视频，可以使用不需要验证的测试 URL。

- **对于在 2023 年 4 月 7 日之前使用 `/business/video/publish/` 端点发布视频的开发者或广告主**，系统已自动将通过 `video_url` 参数指定的视频 URL 对应的域设置为"已验证"状态。建议您使用 `/business/propertylist/` 端点确认您用于托管视频的域是否已自动验证。

## URL 属性类型和所有权验证规则

### Domain（域）

**验证规则**：域验证适用于该域下的所有 URL。

### URL Prefix（URL 前缀）

**验证规则**：URL 前缀验证仅适用于以该前缀开头的 URL。

## 操作步骤

1. 使用 `/business/property/add/` 添加 URL 属性到广告账户
2. 使用 `/business/property/verify/` 验证 URL 属性的所有权
3. 使用 `/business/property/list/` 获取广告账户下已添加的 URL 属性列表
4. 使用 `/business/property/delete/` 删除已验证的 URL 属性所有权

## 相关 API 端点

- `/business/property/add/` - 添加 URL 属性
- `/business/property/verify/` - 验证 URL 属性
- `/business/property/list/` - 获取 URL 属性列表
- `/business/property/delete/` - 删除 URL 属性
- `/business/video/publish/` - 发布视频

# Manage Comments on Owned TikTok Videos

## 概述

本文介绍如何管理拥有的 TikTok 视频上的评论。

## Introduction（简介）

在 TikTok 账户上管理评论对于创建积极的社区体验、促进参与、收集反馈和维护良好的在线形象至关重要。

**您可以使用 Accounts API 有效地审核、回复和分析评论，从而增强您管理 TikTok 账户和与受众互动的能力。**

## Prerequisites（前提条件）

1. **已获得 TikTok API for Business 的访问权限**。详情请参见 Get Started - Step by step workflow。

2. **需要相关权限**：要管理拥有的 TikTok 视频上的评论，您需要相关权限。请参阅 API Reference 以了解每个端点所需的权限，并参阅 Update app permissions 以了解如何配置权限。

3. **拥有已发布的视频**：您需要有一个已发布到 TikTok 账户的拥有视频。如果您还没有视频并想发布公共视频到您的 TikTok 账户，请使用 `/business/video/publish/` 端点。

4. **已完成授权和认证步骤**：您需要按照 Authorization 和 Authentication 中的步骤获取 TikTok 账户访问令牌和应用程序特定的唯一 ID。

## Use Cases and Required Parameters Overview（用例和必需参数概述）

评论管理功能支持以下用例：

### 评论操作

- **创建新评论**：使用 `/business/comment/create/` 端点
- **回复评论**：使用 `/business/comment/reply/create/` 端点
- **点赞评论**：使用 `/business/comment/like/` 端点
- **取消点赞评论**：使用 `/business/comment/like/` 端点（相同端点，不同参数）
- **隐藏评论**：使用 `/business/comment/hide/` 端点
- **取消隐藏评论**：使用 `/business/comment/hide/` 端点（相同端点，不同参数）
- **删除评论**：使用 `/business/comment/delete/` 端点

### 检索评论

- **检索评论**：使用 `/business/comment/list/` 端点
- **检索评论的所有回复**：使用 `/business/comment/reply/list/` 端点

### Webhook 订阅

- **通过 Webhook 订阅评论更新**：使用 `/business/webhook/update/` 端点订阅 `comment.update` 事件

## Steps（操作步骤）

### 步骤 1：获取拥有的 TikTok 视频的 ID

使用 `/business/video/list/` 端点获取视频列表和视频 ID。

### 步骤 2：管理拥有的 TikTok 视频上的评论

根据具体需求，使用相应的端点执行评论管理操作。

# Manage TikTok Post Ad Authorization

## 概述

本文介绍如何管理 TikTok 帖子的广告授权设置。

## Introduction（简介）

"广告授权"功能使 TikTok 帖子能够被用作 Spark Ads 的广告创意。通过授权的帖子，您可以通过授权码从有机帖子创建 Spark Ads。

**您可以使用 Accounts API 有效地生成、扩展和删除 TikTok 帖子的授权码，从而简化授权码的管理。**

## Prerequisites（前提条件）

1. **已获得 TikTok API for Business 的访问权限**。详情请参见 Get Started - Step by step workflow。

2. **需要相关权限**：要管理 TikTok 帖子的授权码，您需要相关权限。请参阅 API Reference 以了解端点所需的权限，并参阅 Update app permissions 以了解如何配置权限。

3. **拥有已发布的帖子**：您需要有一个已发布到 TikTok 账户的拥有帖子。如果您还没有帖子并想发布到您的 TikTok 账户，请使用 `/business/video/publish/` 或 `/business/photo/publish/` 端点。

4. **已获得具有 `biz.spark.auth` 权限的 TikTok 账户访问令牌**，以及通过 Authorization 和 Authentication 中的步骤获得的 TikTok 账户的应用程序特定唯一 ID。

## Steps（操作步骤）

使用以下端点管理 TikTok 帖子的广告授权：

1. **获取帖子列表**：使用 `/business/video/list/` 端点获取已发布的帖子
2. **设置授权**：使用 `/business/post/authorize/setting/` 端点配置授权设置
3. **生成授权码**：使用 `/business/post/authorize/` 端点生成授权码
4. **删除授权码**：使用 `/business/post/authorize/delete/` 端点删除授权码

生成授权码后，可以使用这些授权码创建 Spark Ads。

# Accounts Insights Data Latency

## 概述

当您尝试通过 `/business/get/` 拉取有关 TikTok 账户的关注者基础和个人资料参与度的数据，或通过 `/business/video/list/` 拉取 TikTok 账户有机帖子的触达和参与度数据时，可能会存在延迟。

## Data Latency Levels（数据延迟级别）

`/business/get/` 和 `/business/video/list/` 的数据字段延迟分为两类：**无延迟**和**日级延迟**。

### 无延迟

**实时数据**（如 `username` 和 `share_url`）通常没有延迟。

### 日级数据延迟

**离线数据**（如 `likes` 和 `audience_countries`）通常有 **24-48 小时（UTC 时间）** 的延迟。

## Reference Table for Data Latency（数据延迟参考表）

要快速查看您想要获取的数据字段的预期延迟，请查看下面的参考表。

### 端点字段延迟说明

| 端点 | 字段 | 延迟 |
|------|------|------|
| `/business/get/` | `username`, `display_name`, `profile_image`, `followers_count`（当前总数） | 无 |
| `/business/get/` | 离线统计数据（如 `likes`, `audience_countries` 等） | 24-48 小时 |
| `/business/video/list/` | 基本视频信息（如 `video_id`, `create_time` 等） | 无 |
| `/business/video/list/` | 参与度指标（如 `like_count`, `view_count` 等） | 24-48 小时 |

# Webhooks

## 概述

Webhooks 是自动化的 HTTP 回调，当 TikTok 平台内发生特定事件时会被触发，允许将实时通知发送到您指定的回调 URL。

这种机制消除了不断进行 API 轮询以检索有关异步事件信息的需要。相反，TikTok 会在事件数据对您的系统可用时主动发送事件数据。这些通知通过 HTTPS POST 以 JSON 格式传递到您为应用程序配置的回调 URL。

您可以使用这些实时信息来更新您的系统或触发特定的业务流程，确保您的应用程序与 TikTok 事件保持同步，高效且及时。

## Webhook Callback URL（Webhook 回调 URL）

为了接收 webhook 消息，需要为您的开发者应用程序注册一个 Webhook 回调 URL。要为您的开发者应用程序配置 webhook 回调 URL，请使用 Webhook API 端点 `/business/webhook/update/`。

### 回调 URL 要求

回调 URL 必须满足以下要求：

1. **立即响应 200 HTTP 状态码**以确认收到事件通知
2. **回调 URL 端点必须使用 HTTPS**

### 重试机制

如果未返回 200 HTTP 状态码，TikTok 会假定传递不成功。TikTok 会使用指数退避重试事件通知的传递，最多重试 72 小时。72 小时后，通知将被丢弃且不再发送。

### 重复事件处理

TikTok 尽最大努力实现 webhook 的"至少一次传递"。Webhook 端点可能会多次收到同一事件。应该有针对重复事件的防护措施。

## Webhook Structure（Webhook 结构）

### Request Headers（请求头）

Webhook 请求包含以下 HTTP 头：

- **Content-Type**: `application/json`
- **X-TikTok-Signature**: 用于验证请求来源的签名

### Request Body（请求体）

Webhook 请求体采用 JSON 格式，包含事件类型、时间戳和事件相关的数据负载。

## Webhook 验证

为确保 webhook 请求的真实性和完整性，TikTok 提供了验证机制。详情请参阅 Webhook Verification 文档。

## 相关端点

- `/business/webhook/update/` - 配置和更新 webhook 设置
- `/tt_user/oauth2/token/` - 获取访问令牌

# FAQs

## 概述

本文总结了关于 Accounts API 的常见问题。

## Data Incompleteness（数据不完整性）

### Q1: 当我将 `start_date` 设置为某个特定日期时，为什么我只能看到从稍后某个时间开始的个人资料数据？

**A:** 这可能是由于以下原因：

您可以从 `/business/get/` 获取的数据取决于 TikTok Analytics 应用程序和 https://www.tiktok.com/analytics 中相应数据的可用性。在这种情况下，很可能 TikTok 账户仅在您设置的 `start_date` 之后的某个时间启用了 TikTok Analytics。

因此，在实际启用 TikTok Analytics 的日期之前的任何个人资料数据都无法通过 API 获取。

## Data Discrepancy（数据差异）

### Q1: 为什么 `/business/video/list/` 中的 `shares` 字段显示的分享次数比 TikTok Web UI 上显示的分享计数更多？

**A:** 这可能是由于以下原因：

`/business/video/list/` 中的 `shares` 字段对应于 TikTok 移动应用的 For You feed 中显示的分享数量。它包括外部分享和使用"发送给朋友"按钮发送给朋友的内部分享。

相比之下，TikTok Web UI 上显示的分享计数仅包括外部分享。例如，如果一个视频在外部分享了 30 次，并在 TikTok 应用内分享给朋友 20 次，则 TikTok 应用会显示 50 次分享，而 TikTok Web UI 仅显示 30 次分享。

## Authorization（授权）

### Q1: 如何撤销授权？

**A:** 要撤销授权，可以使用 `/tt_user/oauth2/revoke/` 端点。您也可以在 My Apps 中管理授权设置。

## Miscellaneous（其他问题）

### Q1: 我可以使用 Accounts API 发布视频和照片吗？

**A:** 是的，您可以使用以下端点：
- `/business/video/publish/` - 发布视频
- `/business/photo/publish/` - 发布照片

这些端点允许您将内容发布到 Business Account 或 Personal Account。

# 素材发布与视频链接（本系统）

## 概述

在本系统中，通过「发布」或「更新状态」流程调用 TikTok 的发布状态接口（`/business/publish/status/`）后，若状态为 `PUBLISH_COMPLETE` 且接口返回了 `post_ids`（或 `publicaly_available_post_id`），系统会：

1. **保存 post_id**：将接口返回的 post_id 列表写入素材库表的「post_ids」相关字段。
2. **写入 TikTok 视频链接**：在素材库表的 **「TikTok视频链接」** 列写入发布后的视频链接，格式为：
   - `https://www.tiktok.com/@{用户名}/video/{post_id}`  
   其中「用户名」来自账号列表中该发布账号对应记录的 **username** 或 **用户名** 字段；若未配置则使用占位 `user`。

因此，**素材发布完成后，素材库里的「TikTok视频链接」列会自动带有发布后的视频链接**。请确保账号列表中已配置 **username** 或 **用户名** 字段并填写正确，以便生成可点击的链接。

# 参考文献

[1] [Overview](https://business-api.tiktok.com/portal/docs?id=1737944384433218)
[2] [Authorization](https://business-api.tiktok.com/portal/docs?id=1738083939371009)
[3] [Get Started](https://business-api.tiktok.com/portal/docs?id=1760334598980610)
[4] [Authentication](https://business-api.tiktok.com/portal/docs?id=1738084387220481)
[5] [Rate Limits](https://business-api.tiktok.com/portal/docs?id=1738084416214017)
[6] [Manage URL Properties](https://business-api.tiktok.com/portal/docs?id=1769324038780930)
[7] [Manage Comments on Owned TikTok Videos](https://business-api.tiktok.com/portal/docs?id=1776065099288577)
[8] [Manage TikTok Post Ad Authorization](https://business-api.tiktok.com/portal/docs?id=1815124785075201)
[9] [Accounts Insights Data Latency](https://business-api.tiktok.com/portal/docs?id=1746624508278786)
[10] [Webhooks](https://business-api.tiktok.com/portal/docs?id=1759977800177665)
[11] [FAQs](https://business-api.tiktok.com/portal/docs?id=1776983576127490)
