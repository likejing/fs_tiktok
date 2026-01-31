# 网站监测配置说明

本项目已接入第三方监测，用于查看**用户数、停留时长、用户行为**等数据，便于后续优化系统。无需自建后台，直接使用第三方控制台查看报表。

## 支持的平台

| 平台 | 环境变量 | 说明 |
|------|----------|------|
| **Google Analytics 4** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | 全球常用，用户数/会话/停留时长/事件 |
| **百度统计** | `NEXT_PUBLIC_BAIDU_TONGJI_ID` | 国内访问友好，数据在百度统计后台查看 |

可只配一个，也可两个都配（数据会同时上报）。

---

## 一、Google Analytics 4（GA4）

### 1. 获取 Measurement ID

1. 打开 [Google Analytics](https://analytics.google.com/)
2. 创建或选择「媒体资源」→ 选择「数据流」→ 选择「网站」
3. 复制 **衡量 ID**，格式为 `G-XXXXXXXXXX`

### 2. 配置环境变量

在项目根目录的 `.env.local`（开发）或 `.env.production`（生产）中增加：

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3. 在 GA4 中可查看的数据

- **用户数**：报告 → 参与度 → 用户
- **停留时长**：报告 → 参与度 → 互动度（平均互动时间）
- **页面/路径**：报告 → 参与度 → 网页和屏幕
- **事件**：报告 → 参与度 → 事件（含自定义事件如 `tab_switch`、`action_click` 等）

---

## 二、百度统计

### 1. 获取统计 ID

1. 打开 [百度统计](https://tongji.baidu.com/)
2. 添加网站 → 填写网站地址
3. 获取统计代码中的 **ID**（`hm.js?` 后面的那串字符）

### 2. 配置环境变量

```env
NEXT_PUBLIC_BAIDU_TONGJI_ID=你的百度统计ID
```

### 3. 在百度统计中可查看的数据

- **访客数 / UV**：报告 → 趋势分析
- **浏览量 / PV**：报告 → 趋势分析
- **访问时长**：报告 → 访客分析 → 访问时长
- **自定义事件**：报告 → 事件分析（需在后台配置事件）

---

## 三、当前已埋点

| 类型 | 说明 |
|------|------|
| **页面浏览** | 每次路由变化自动上报（含首屏），用于 PV/UV 和停留时长 |
| **Tab 切换** | 用户在「账号 / 视频 / 评论 / 发布 / AI / Nano / 社媒」之间切换时上报事件 `tab_switch`，参数 `tab` 为当前 Tab 的 key |

在 GA4 中可在「事件」里按 `tab_switch`、`action_click` 等筛选；在百度统计中需在「事件跟踪」中配置对应事件名。

---

## 四、扩展自定义事件

在需要统计的按钮点击、表单提交等位置调用：

```ts
import { trackEvent, AnalyticsEvents } from '../lib/analytics';

// 例如：用户点击「批量生成」
trackEvent(AnalyticsEvents.ACTION_CLICK, { action: 'batch_generate', module: 'ai' });

// 或自定义事件名
trackEvent('button_click', { button_name: '发布视频' });
```

`lib/analytics.ts` 中的 `AnalyticsEvents` 可继续增加统一事件名，便于在 GA4/百度统计里做筛选与对比。

---

## 五、隐私与合规

- 未配置上述环境变量时，**不会加载任何第三方脚本**，也不会上报数据。
- 使用 GA4 / 百度统计时，请根据实际业务在隐私政策中说明数据收集与用途，并遵守当地法规（如 GDPR、个保法）。

---

## 六、验证是否生效

1. 配置好环境变量后重新构建并部署：`npm run build`
2. 打开网站，随意切换几个页面和 Tab
3. **GA4**：约 24–48 小时后在「报告 → 实时」中可看到实时访问；历史报告需等待约 24 小时
4. **百度统计**：一般约 20 分钟后在「报告 → 实时访客」中可看到数据
