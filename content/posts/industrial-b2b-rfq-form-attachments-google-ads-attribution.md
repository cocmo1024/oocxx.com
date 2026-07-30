---
title: "工业 B2B 询盘表单、图纸附件与 Google Ads 归因"
description: "完整拆解工业 B2B 网站如何把广告点击、在线 RFQ、CAD 图纸附件、Cloudflare 安全与邮件服务连接为可审计、可去重的 Google Ads 询盘转化链路。"
summary: "从点击标识、表单附件和 Turnstile，到邮件接受、Submission ID 与 Ads transaction_id：一套以服务器 accepted=true 为转化边界的生产方案。"
date: 2026-07-30T20:34:05+08:00
lastmod: 2026-07-30T20:34:05+08:00
draft: false
content_language: "zh-CN"
locale: "zh_CN"
keywords:
  - 工业 B2B 询盘系统
  - RFQ 在线表单
  - CAD 图纸上传
  - Google Ads 归因
  - Cloudflare Workers
categories:
  - 网站工程
  - 数字营销
tags:
  - RFQ
  - Google Ads
  - Cloudflare Workers
  - Turnstile
  - 转化跟踪
  - B2B 表单
series:
  - 生产架构实录
---

> 本文基于一个真实工业制造网站的生产架构整理，但已完成脱敏。域名、邮箱、账户编号、Google Ads Conversion ID、Conversion Label、Turnstile 密钥及 Cloudflare Binding ID 均使用占位符。

## 一、系统真正要解决的问题

工业 B2B 网站的转化不能简单定义为“用户点击了提交按钮”。

一次按钮点击之后，仍然可能发生：

- 必填字段不完整；
- 邮箱格式错误；
- Cloudflare Turnstile 验证失败；
- 图纸数量或容量超限；
- 文件格式不受支持；
- API 请求被限流；
- 邮件服务拒绝附件；
- 提交请求超时；
- 同一询盘被重复发送；
- 页面显示成功，但 Google Ads 转化事件实际上没有发出。

因此，这套系统采用的核心原则是：

> 只有服务器完成安全验证、字段验证、图纸验证，并且 Cloudflare 邮件服务接受了询盘之后，浏览器才允许向 Google Ads 报告一次正式转化。

“点击 Submit”只是意向；`accepted=true` 才是转化边界。

---

## 二、整体架构

```text
Google Ads 点击（gclid / gbraid / wbraid / UTM）
        ↓
网站首页或 RFQ 页面
        ↓
浏览器保存第一方归因信息
        ↓
用户填写 RFQ 并上传图纸
        ↓
Cloudflare Turnstile
        ↓
POST /api/rfq（multipart/form-data）
        ↓
Cloudflare Worker
        ↓
同源、限流、蜜罐、时间、字段与附件验证
        ↓
Turnstile Siteverify
        ↓
Cloudflare Email Binding 返回 messageId
        ↓
accepted=true + Submission ID
        ├── GA4 generate_lead
        ├── Google Ads conversion（transaction_id = Submission ID）
        └── 页面显示询盘参考编号
```

系统主要由五部分组成：

1. Astro 静态网站与 RFQ 表单；
2. Cloudflare Workers Static Assets；
3. `/api/rfq` Worker 接口；
4. Cloudflare Turnstile、Rate Limiting 和 Email Service；
5. Google tag、GA4、Google Ads 转化及第一方归因记录。

首页和独立 RFQ 页面可以复用同一套表单组件。即使所有广告最终都进入首页，也可以通过 Google 自动标记和 UTM 参数识别广告系列、广告组、关键词和素材，而不需要制造大量内容相同的落地页。

---

## 三、从广告点击到询盘的完整数据流

### 1. 用户进入网站

广告最终网址可以是：

```text
https://example-industrial.com/
```

自动标记开启后，Google 可能附加：

```text
?gclid=...
```

在隐私受限场景中也可能出现：

```text
?gbraid=...
?wbraid=...
```

同时可以使用跟踪模板或最终网址后缀增加：

```text
utm_source=google
utm_medium=cpc
utm_campaign={campaignid}
utm_content={creative}
utm_term={keyword}
```

Google Ads 的 ValueTrack 参数配置可参考[官方说明](https://support.google.com/google-ads/answer/6305348?hl=en)。

### 2. 浏览器保存第一方归因副本

当前实现采集：

- `gclid`
- `gbraid`
- `wbraid`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- 受支持的项目上下文 `project`
- `first_landing_page`
- `last_landing_page`
- `captured_at`
- `updated_at`
- `expires_at`

数据同时尝试写入 `localStorage` 和 `sessionStorage`，保存窗口为滚动 90 天。浏览器隐私设置阻止某一种存储时，系统会尝试另一种；全部失败也不能阻止用户提交询盘。

这里必须区分两种归因：

- 这份浏览器记录是供销售邮件、CRM 和内部审计使用的“第一方来源副本”；
- Google Ads 的在线转化归因仍主要依赖 Google tag、广告点击标识和 Google 自身的归因机制。

把 `gclid` 写进询盘邮件，不等于已经完成 Google Ads 离线转化回传。

### 3. 页面建立 Submission ID

表单初始化时，通过：

```js
crypto.randomUUID()
```

建立一个 UUID v4，并放入隐藏字段：

```html
<input name="submission_id" type="hidden">
```

同时记录：

```html
<input name="started_at" type="hidden">
<input name="source_page" type="hidden">
<input name="attribution" type="hidden">
```

这个编号会贯穿：

- 浏览器提交；
- Worker 校验；
- 内部邮件；
- 页面成功回执；
- Google Ads `transaction_id`。

当前实现由浏览器生成 UUID，再由服务器校验并回传。更强的版本应由服务器签发并持久化，以实现真正的幂等处理。

---

## 四、在线 RFQ 表单设计

### 1. 核心字段

表单要求的主要字段包括：

- 姓名：最多 80 字符；
- 工作邮箱：最多 254 字符；
- 公司名称：最多 120 字符；
- 项目说明：30～4000 字符；
- 数据处理同意；
- Turnstile 安全验证。

可选字段包括：

- 应用场景；
- 材料；
- 数量或项目阶段；
- 目标交期；
- 国家或地区；
- CAD、工程图纸和参考文件。

前端校验主要用于改善体验，服务器必须再次执行独立校验。攻击者完全可以绕过页面，直接构造 HTTP 请求。

### 2. 事件分层

表单漏斗事件可以包括：

- `rfq_form_view`
- `rfq_form_start`
- `rfq_submit_attempt`
- `rfq_validation_error`
- `rfq_submit_failure`
- `rfq_form_submit_success`
- `generate_lead`

其中，前五项只用于漏斗分析，不能设置为 Google Ads 的主要转化。

正式 Ads 转化只能绑定在 `rfq_form_submit_success` 的服务器成功回调之后。

---

## 五、工程图纸附件的完整处理

### 1. 支持的文件类型

当前表单允许：

| 类型 | 扩展名 | 邮件 MIME |
|---|---|---|
| PDF 图纸 | `.pdf` | `application/pdf` |
| STEP 模型 | `.step`、`.stp` | `model/step` |
| STL 模型 | `.stl` | `model/stl` |
| IGES 模型 | `.iges`、`.igs` | `model/iges` |
| Parasolid | `.x_t`、`.x_b` | `application/octet-stream` |
| JPEG 图片 | `.jpg`、`.jpeg` | `image/jpeg` |
| PNG 图片 | `.png` | `image/png` |

前端示例：

```html
<input
  name="attachments"
  type="file"
  accept=".pdf,.step,.stp,.stl,.iges,.igs,.x_t,.x_b,.jpg,.jpeg,.png"
  multiple
>
```

`accept` 只控制文件选择器的提示，并不构成安全验证。

### 2. 数量和容量限制

当前限制为：

- 最多 3 个附件；
- 单个文件不超过 5 MiB；
- 全部文件合计不超过 8 MiB。

前端在用户选择文件后立即检查，并在提交前再次检查；Worker 收到请求后还会重新检查：

```ts
const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 8 * 1024 * 1024;
```

任一文件失败，Worker 立即返回 `400`：

- 不发送邮件；
- 不显示成功页面；
- 不触发 Google Ads 转化。

### 3. 为什么还要限制总大小

只限制“每个文件 5 MiB”是不够的。三个 5 MiB 文件就可能达到 15 MiB，而且邮件 MIME 编码、HTML 正文和 Headers 还会产生额外开销。

截至 2026 年 7 月，Cloudflare Email Service 对普通外发邮件和发往已验证目标地址的邮件有不同总大小限制。固定 RFQ 收件箱应使用已验证地址，并为 MIME 编码留出余量。具体限制应以[Cloudflare Email Service Limits](https://developers.cloudflare.com/email-service/platform/limits/)为准。

因此，8 MiB 是“原始附件合计上限”，不应被理解为最终邮件只有 8 MiB。

### 4. 文件名清洗

服务端不会直接采用浏览器提供的原始文件名，而是：

1. 去掉 `/` 和 `\` 之前的路径；
2. 只保留文件名 basename；
3. 将不在安全字符范围内的字符替换为 `_`；
4. 最长保留 120 字符。

示例：

```ts
function safeFileName(name) {
  const baseName = name.split(/[\\/]/).pop() || 'attachment';

  return baseName
    .replace(/[^a-zA-Z0-9._() -]/g, '_')
    .slice(0, 120);
}
```

这样可以降低：

- 路径穿越；
- 控制字符污染；
- 邮件 Header 注入；
- 超长文件名；
- 部分邮件客户端解析异常。

代价是中文图纸名可能被替换成多个下划线，两个不同文件也可能在清洗后重名。升级时应给附件增加序号或 Submission ID 前缀。

### 5. MIME 类型不能信任浏览器

浏览器上传的 `file.type` 可能为空，也可能被伪造，尤其是 CAD 文件。

当前系统依据服务器认可的扩展名映射 MIME，而不是直接信任 `file.type`：

```ts
const derivedType =
  fileContentTypes.get(extension) ||
  'application/octet-stream';
```

但必须承认：这仍然只是“扩展名驱动的 MIME 映射”，不是真正的内容识别。

### 6. 邮件附件组装

验证完成后，Worker 将文件读入内存：

```ts
const attachments = await Promise.all(
  files.map(async (file) => ({
    filename: safeFileName(file.name),
    content: await file.arrayBuffer(),
    type: getDerivedMimeType(file.name),
    disposition: 'attachment'
  }))
);
```

然后和询盘正文一起发送：

```ts
const result = await env.RFQ_EMAIL.send({
  from: 'rfq@example-industrial.com',
  to: 'sales@example-industrial.com',
  replyTo: customerEmail,
  subject: `[RFQ ${submissionId.slice(0, 8)}] New project`,
  text: textBody,
  html: htmlBody,
  attachments,
  headers: {
    'X-RFQ-Submission-ID': submissionId
  }
});
```

Cloudflare Workers Email API 的附件结构可参考[官方文档](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)。

关键安全设计是：

- `From` 使用企业域名下的固定发件地址；
- `To` 使用固定且已验证的内部邮箱；
- 客户邮箱只作为 `Reply-To`；
- HTML 正文必须转义；
- 公司名、应用名称等进入 Subject 前必须移除 CR/LF；
- `messageId` 缺失时不能认为发送成功。

不要把客户邮箱直接放进 `From`，否则容易触发 SPF、DKIM、DMARC 问题，也可能形成邮件头注入风险。

### 7. 当前附件安全边界

当前系统已经防住了常见的数量、大小、扩展名和文件名问题，但尚未实现：

- 文件魔数或真实内容校验；
- 恶意软件扫描；
- PDF 内嵌脚本检查；
- CAD 文件内容审查；
- 文件哈希审计；
- 重复附件检测；
- 涉密或出口管制内容自动识别；
- 附件隔离和生命周期管理。

扩展名正确不代表文件安全。更高安全等级的架构应当是：

```text
上传 → 对象存储隔离区 → 计算哈希 → 内容识别
→ 恶意软件扫描 → 审核通过 → 生成短期签名链接
→ 邮件只发送链接，不直接发送原文件
```

对于受出口管制、涉密或受限制的工程资料，应明确提示客户在签署适当处理协议前不要通过普通表单上传。

---

## 六、Cloudflare Workers 的生产配置

### 1. 静态网站与 API 共用一个 Worker

脱敏后的 `wrangler.jsonc` 可以写成：

```jsonc
{
  "name": "example-industrial-com",
  "main": "./functions/api/rfq.ts",
  "compatibility_date": "YYYY-MM-DD",
  "compatibility_flags": [
    "nodejs_compat",
    "global_fetch_strictly_public"
  ],

  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page",
    "run_worker_first": ["/api/*"]
  },

  "send_email": [
    {
      "name": "RFQ_EMAIL",
      "destination_address": "sales@example-industrial.com"
    }
  ],

  "ratelimits": [
    {
      "name": "RFQ_RATE_LIMITER",
      "namespace_id": "<RATE_LIMIT_NAMESPACE_ID>",
      "simple": {
        "limit": 5,
        "period": 60
      }
    }
  ],

  "observability": {
    "enabled": true
  }
}
```

`run_worker_first: ["/api/*"]` 非常重要：

- `/api/rfq` 先进入 Worker；
- 普通 HTML、CSS、JS 和图片继续由 Static Assets 处理；
- 非 API 请求由 `env.ASSETS.fetch(request)` 返回。

如果漏掉它，`/api/rfq` 可能被当作静态路径处理，最终出现：

- 404；
- 返回 HTML 错误页；
- 前端调用 `response.json()` 失败；
- SPA fallback 返回假 200。

Cloudflare 对 Static Assets binding 和 `run_worker_first` 的说明见[官方文档](https://developers.cloudflare.com/workers/static-assets/binding/)。

### 2. Turnstile 后台设置

Cloudflare Dashboard 中：

1. 进入 Turnstile；
2. 选择 Add widget；
3. 建立单独的生产 widget；
4. 模式选择 Managed；
5. 配置实际生产主机名；
6. 测试环境使用独立 widget；
7. 保存 Sitekey 和 Secret key。

前端使用公开的 Sitekey：

```env
PUBLIC_TURNSTILE_SITE_KEY=<TURNSTILE_SITE_KEY>
```

Worker 使用加密 Secret：

```text
TURNSTILE_SECRET_KEY=<TURNSTILE_SECRET_KEY>
```

Secret 不能放入：

- HTML；
- `PUBLIC_*` 变量；
- 客户端 JavaScript；
- Git 仓库；
- 普通明文配置。

可在 Worker 后台的 Variables and Secrets 中添加，或者执行：

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Cloudflare 的 Secret 管理说明见[Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。

### 3. Turnstile 前端与后端必须配对

前端：

```html
<div
  class="cf-turnstile"
  data-sitekey="<TURNSTILE_SITE_KEY>"
  data-theme="auto"
  data-size="flexible"
  data-action="rfq_submit"
></div>
```

服务端调用：

```text
POST https://challenges.cloudflare.com/turnstile/v0/siteverify
```

并提交：

- `secret`
- `response`
- 可选的 `remoteip`

系统不仅检查 `success=true`，还严格检查：

```ts
result.action === 'rfq_submit'
result.hostname === requestHostname
```

Turnstile Token 最长 2048 字符、有效期约 300 秒，而且只能使用一次。服务端 Siteverify 是强制步骤，不能因为页面出现了验证码就省略。[Cloudflare 官方说明](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

当前接口还为 Siteverify 设置了约 8 秒超时。失败后，浏览器必须执行：

```js
turnstile.reset();
```

否则用户再次提交时可能继续携带已经使用或过期的 Token。

### 4. Email Binding 设置

Cloudflare 中需要：

1. 为发件域名完成 Email Sending 接入；
2. 配置 SPF、DKIM、DMARC 等记录；
3. 添加并验证固定内部收件邮箱；
4. 创建名为 `RFQ_EMAIL` 的 Send Email binding；
5. 用 `destination_address` 限制允许发送的目标。

Binding 名必须和代码里的：

```ts
env.RFQ_EMAIL
```

完全一致。

限制固定目标地址的目的，是避免代码漏洞把 Worker 变成任意邮件发送器。相关设置见[Cloudflare Send Email bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)。

`messageId` 只证明 Cloudflare Email Service 已接受发送任务，不证明最终已经送达收件箱。最终投递仍需结合 Email Sending 日志、退信记录和收件箱状态判断。

### 5. Rate Limiting

当前策略可表达为：

```text
每个 CF-Connecting-IP：
60 秒内最多 5 次 RFQ 请求
```

代码：

```ts
const ip =
  request.headers.get('CF-Connecting-IP') ||
  'unknown';

const result = await env.RFQ_RATE_LIMITER.limit({
  key: `rfq:${ip}`
});

if (!result.success) {
  return jsonResponse(429, {
    accepted: false,
    message: 'Too many attempts'
  });
}
```

Cloudflare Rate Limiting Binding 是按边缘节点执行的宽松防滥用机制，具有最终一致性，不应拿来做精确计费或绝对配额。[官方说明](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

生产与测试环境应使用不同 namespace。如果 Binding 缺失，而代码选择继续运行，接口就会失去这一层保护；安全要求较高时可以让生产环境缺失 Binding 直接失败。

### 6. 日志和监控

建议开启 Workers Observability，但日志必须脱敏。

可以记录：

```json
{
  "event": "rfq_rejected",
  "submission_id": "脱敏编号",
  "reason": "turnstile_action_mismatch",
  "status": 400
}
```

不要记录：

- Turnstile Token；
- Turnstile Secret；
- 完整客户邮箱和电话；
- 完整项目说明；
- 图纸二进制；
- 敏感零件编号；
- 完整原始文件名；
- 点击标识与个人资料的完整组合。

Workers 日志配置可参考[Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)。

---

## 七、Worker 接口的验证顺序

`/api/rfq` 的推荐顺序是：

1. 只允许 `POST`，其他方法返回 `405`；
2. 要求请求带同源 `Origin`，否则返回 `403`；
3. 只接受 `multipart/form-data`，否则返回 `415`；
4. 检查 Turnstile Secret 和 Email Binding，缺失返回 `503`；
5. 按 IP 执行限流，超限返回 `429`；
6. 解析 FormData；
7. 检查隐藏蜜罐；
8. 检查填写耗时；
9. 调用 Turnstile Siteverify；
10. 校验 UUID、邮箱、字段长度和枚举白名单；
11. 校验同意字段；
12. 校验图纸数量、大小、扩展名和文件名；
13. 生成纯文本及转义后的 HTML 邮件；
14. 发送邮件并要求返回 `messageId`；
15. 返回 `accepted=true` 和 Submission ID。

典型响应语义：

| HTTP 状态 | 含义 | 是否记录正式转化 |
|---|---|---:|
| `200, accepted:false` | 蜜罐命中等静默拒绝 | 否 |
| `200, accepted:true` | 业务接口已接受询盘 | 是 |
| `400` | 字段、图纸、时间或 Turnstile 无效 | 否 |
| `403` | Origin 不符合要求 | 否 |
| `405` | 请求方法不允许 | 否 |
| `415` | 不是 multipart 表单 | 否 |
| `429` | 请求过于频繁 | 否 |
| `502` | 邮件服务未接受 | 否 |
| `503` | Secret 或 Binding 缺失 | 否 |

所有 JSON 响应应设置：

```text
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

### 蜜罐为什么返回 200

自动机器人填写隐藏字段后，接口返回：

```json
{
  "ok": true,
  "accepted": false
}
```

返回 200 是为了避免直接告诉机器人“你触发了反垃圾规则”。前端仍必须检查 `accepted === true`，不能只检查 HTTP 200。

### 填写时间只能作为弱信号

当前系统要求：

- 至少填写约 3 秒；
- 表单打开不超过 24 小时。

但 `started_at` 来自浏览器，可以受到用户系统时间偏差影响，也可以被攻击者伪造。因此，它只能作为蜜罐、Turnstile 和限流之外的辅助信号，不能作为核心安全机制。

---

## 八、只有服务器确认后才触发转化

前端提交时不要手动设置 `Content-Type`。浏览器需要为 `FormData` 自动生成 multipart boundary：

```js
const response = await fetch('/api/rfq', {
  method: 'POST',
  body: new FormData(form),
  headers: {
    Accept: 'application/json'
  },
  credentials: 'same-origin'
});

const result = await response.json();

if (
  !response.ok ||
  result.accepted !== true ||
  !result.submissionId
) {
  throw new Error(result.message || 'RFQ rejected');
}
```

只有走到这里，才执行：

```js
trackEvent('rfq_form_submit_success', {
  submission_id: result.submissionId,
  transaction_id: result.submissionId,
  has_attachments: attachmentCount > 0,
  attachment_count: attachmentCount
});
```

注意普通事件中只放：

- 业务分类；
- 页面位置；
- 应用分类；
- 材料分类；
- 有无附件；
- 附件数量；
- Submission ID。

不要放客户姓名、邮箱、电话、图纸名称或项目说明。

---

## 九、Google Ads 后台如何配置

后台路径通常为：

```text
目标
→ 转化
→ 摘要
→ 创建转化操作
→ 网站转化
→ 输入并扫描域名
→ 手动使用代码设置
```

Google 的手动建立说明见[官方文档](https://support.google.com/google-ads/answer/12718882?hl=en)。

### 建议的 RFQ 转化设置

| 设置 | 建议 |
|---|---|
| 转化名称 | `RFQ Submitted` 或 `Qualified RFQ Submitted` |
| 来源 | 网站 |
| 类别 | `Submit lead form` 或 `Request quote` |
| 操作优化 | Primary |
| Count | One |
| 点击后转化窗口 | 根据点击到 RFQ 的 time lag 决定；长周期项目可评估 90 天 |
| 价值 | 无可靠数据时不要虚构收入；可先不使用或采用经验证的线索价值 |
| 增强型转化 | 合规且取得同意后启用 |
| 广告系列目标 | 必须确认该广告系列实际选择了这条目标 |

对于 B2B 询盘，Google 推荐使用 `One`，因为同一次广告互动产生的重复线索通常不应全部计算。[Google 转化计数说明](https://support.google.com/google-ads/answer/3438531?hl=en)

`One` 和 `transaction_id` 不是一回事：

- `Count = One` 控制一次广告互动下的计数方式；
- `transaction_id` 用于识别同一笔提交并帮助去重。

### Primary 和 Secondary

建议：

- 服务器接受的 RFQ：Primary；
- 表单开始填写：Secondary 或仅 GA4；
- 提交按钮点击：Secondary 或仅 GA4；
- 邮箱复制：Secondary；
- 电话按钮点击：Secondary；
- 普通页面访问：不作为主要线索转化。

Primary 转化只有在所属目标被该广告系列采用时，才会进入智能出价信号。相关定义见[Google Primary/Secondary 转化说明](https://support.google.com/google-ads/answer/11461796?hl=en)。

不要把“邮箱复制”和“真实 RFQ”同时设为同等 Primary，否则系统可能逐渐购买大量便宜但没有实际询盘的点击。

---

## 十、Google tag 的正确安装

生产配置可以通过构建变量注入：

```env
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
PUBLIC_GOOGLE_ADS_CONVERSION_ID=AW-XXXXXXXXXX
PUBLIC_GOOGLE_ADS_RFQ_SUBMIT_CONVERSION_LABEL=RFQ_CONVERSION_LABEL
PUBLIC_GOOGLE_TAG_MANAGER_ID=GTM-XXXXXXX
```

这些 ID 会出现在浏览器中，本身不是密码；但仍应按生产、测试环境分别管理，避免测试站向生产广告账户发送事件。

Google tag 的初始化函数必须保留官方语义：

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

官方示例见[Google tag 安装说明](https://support.google.com/google-ads/answer/12985952?hl=en)。

### 一个非常隐蔽的真实 Bug

下面这种看似更现代的改写是不安全的：

```js
function gtag(...args) {
  dataLayer.push(args);
}
```

官方写法压入的是原生 `Arguments` 对象：

```text
[object Arguments]
```

改写后压入的是普通数组：

```text
[object Array]
```

表面上：

- `dataLayer` 有内容；
- 自定义对象事件也能看见；
- 页面没有 JavaScript 报错。

但 Google tag 运行时可能无法把这些 Array 当作标准 `config`、`set` 和 `event` 命令处理，最终出现：

> 看起来埋点存在，实际上没有发出 Google Ads conversion 请求。

第三方标签初始化代码不是普通业务函数，不能只因为语法更简洁就改变其数据协议。

关于该故障的网络层证据、排查过程和最小修复，另见 [dataLayer 类型错误导致 Google Ads 转化不发送](../google-ads-datalayer-conversion-not-sent/)。

---

## 十一、正式转化事件

服务器确认成功后发送：

```js
gtag('event', 'conversion', {
  send_to: 'AW-XXXXXXXXXX/RFQ_CONVERSION_LABEL',
  transaction_id: submissionId,
  event_category: 'lead',
  event_label: application || 'RFQ submission',
  transport_type: 'beacon'
});
```

其中：

- `AW-XXXXXXXXXX` 是 Google Ads destination ID；
- `/` 后面是该转化操作的 Conversion Label；
- 二者必须来自同一条转化操作；
- `transaction_id` 必须对每个真实询盘唯一；
- 不得把邮箱、电话或客户姓名写入 `transaction_id`。

Google 对 Transaction ID 去重的说明见[官方文档](https://support.google.com/google-ads/answer/6386790?hl=en)。

当前实现还通过：

- 内存中的 `Set`；
- `sessionStorage`；
- `rfq_submit_<Submission ID>` 去重键；

减少同一个浏览器会话内的重复触发。

但前端去重不能代替服务器幂等。若邮件已经被服务接受、浏览器却没有收到响应，用户重试时仍可能产生第二封邮件。

更强的设计应使用 KV、D1 或数据库保存：

```text
Submission ID
状态：processing / accepted / rejected
messageId
创建时间
附件哈希
```

相同 Submission ID 再次出现时，服务器返回原结果，而不是重复发信。

---

## 十二、增强型转化与隐私

取得明确同意后，可对邮箱进行规范化：

```js
const normalizedEmail =
  customerEmail.trim().toLowerCase();

gtag('set', 'user_data', {
  email: normalizedEmail
});

gtag('event', 'conversion', {
  send_to: 'AW-XXXXXXXXXX/RFQ_CONVERSION_LABEL',
  transaction_id: submissionId
});
```

Google tag 可以按规范处理并散列受支持的第一方数据。后台还需要开启 Enhanced Conversions、接受客户数据条款，并选择和代码一致的实现方式。[Google 增强型转化说明](https://support.google.com/google-ads/answer/13258081?hl=en)

必须注意：

> 表单中的“允许我们处理询盘资料”复选框，不等于已经完成 Consent Mode。

如果覆盖欧洲等存在同意管理要求的市场，还要单独处理：

- `ad_storage`
- `analytics_storage`
- `ad_user_data`
- `ad_personalization`

具体参见[Google Consent Mode 指南](https://developers.google.com/tag-platform/security/guides/consent)。

不得把邮箱写入：

- URL；
- UTM；
- `event_label`；
- 自定义维度；
- Submission ID；
- 普通 dataLayer 业务事件。

---

## 十三、归因系统当前的边界

### 1. 所有广告进入首页仍然可以区分

所有广告可以实际进入同一首页，然后通过以下字段区分：

- Google 自动标记；
- Campaign ID；
- Ad Group ID；
- Keyword；
- Creative ID；
- 自定义 UTM；
- 页面中的项目上下文。

这比建立大量内容重复的伪落地页更容易维护，也不会破坏首页的真实业务路径。

### 2. 第一方归因记录不是绝对可信

隐藏字段和 `localStorage` 都由客户端控制，所以：

- `gclid` 可以被伪造；
- UTM 可以被修改；
- Source Page 可以被构造；
- 用户可以清空存储；
- 隐私浏览器可能拒绝存储。

这些字段适合营销分析和线索上下文，但不能直接作为财务结算或客户身份认证依据。

### 3. 当前记录可能混合不同访问来源

如果用户先通过一个广告进入，之后通过另一条带不同 UTM 的链接访问，按字段独立更新可能形成：

```text
旧 gclid + 新 utm_campaign
```

升级时建议将每次触点保存为独立记录：

```json
{
  "first_touch": {},
  "last_touch": {},
  "touch_history": []
}
```

同时不要长期保存完整 URL。应只保留允许的查询参数，防止其他系统把邮箱、报价编号或敏感标识放进 URL 后被一并写入邮件。

---

## 十四、降级转化链路及其风险

当前实现可以在 Google tag 加载失败、被禁用或等待超时时，尝试加载旧版 `conversion.js`，再降级到 1×1 conversion pixel。

它能提高极端环境下的测量覆盖，但属于低质量降级路径：

- 不一定携带 `transaction_id`；
- 不携带增强型转化邮箱；
- 无法证明网络请求真正成功；
- 脚本插入页面后就可能被标记为“已发送”；
- 广告拦截器仍可能阻止最终请求。

因此，应把 fallback 单独记录为：

```text
measurement_mode = fallback
```

不能把“调用了 gtag”或“创建了 Image 对象”视为已被 Google Ads 接收。

---

## 十五、端到端验证方法

一次完整验收至少要验证四层。

### 1. 表单和附件

测试矩阵应包括：

- 不带附件；
- 1 个正常附件；
- 3 个正常附件；
- 4 个附件；
- 单文件恰好 5 MiB；
- 单文件略大于 5 MiB；
- 合计恰好 8 MiB；
- 合计略大于 8 MiB；
- 不支持的扩展名；
- `drawing.step.exe`；
- 空文件；
- 中文或超长文件名；
- 两个清洗后同名的文件；
- 扩展名正确但内容损坏的文件。

### 2. Cloudflare

检查：

- Turnstile Siteverify 是否成功；
- `action` 是否为 `rfq_submit`；
- `hostname` 是否正确；
- 超限是否返回 `429`；
- 邮件是否返回 `messageId`；
- Email Sending 日志是否接受；
- 收件箱是否最终收到；
- 图纸是否完整可下载；
- 邮件中的 Submission ID 是否与页面一致。

Cloudflare 本地模拟对二进制邮件附件存在限制。如果切换到远程开发环境，测试可能产生真实邮件，必须使用专用测试收件箱和 Turnstile 测试密钥。

### 3. 浏览器和 Google tag

在 Chrome 中通过 Google Ads 转化操作的 Troubleshoot 打开 Tag Assistant：

1. 从首页或实际广告落地路径进入；
2. 正常填写表单；
3. 上传允许的测试图纸；
4. 完成 Turnstile；
5. 确认 API 返回 `accepted=true`；
6. 检查 dataLayer；
7. 检查 Google tag ID；
8. 检查 Conversion Label；
9. 在 Network 中查找：

```text
googleadservices.com/pagead/conversion/
```

10. 检查请求中的 `oid` 或 Transaction ID；
11. 确认同一次提交只生成一次 conversion。

Tag Assistant 的官方排查流程见[Google Ads 说明](https://support.google.com/google-ads/answer/10989978?hl=en)。

只看到 `dataLayer.push()` 不算验证成功，必须确认实际网络命中。

### 4. Google Ads 后台

Google Ads 后台状态存在延迟。标签修正后：

- Tag Assistant 可能较快显示正确；
- 转化操作状态可能需要约 30 分钟或更久；
- 报表数据可能需要数小时，部分状态可能延迟 24～48 小时。

没有有效广告点击的内部测试可以证明技术链路，但不一定产生一条可归因的广告转化。

---

## 十六、最容易出现的 Bug

| 现象 | 常见原因 | 处理方法 |
|---|---|---|
| `/api/rfq` 返回 HTML | `run_worker_first` 未覆盖 `/api/*` | 修正 Static Assets 路由 |
| API 返回 415 | 手工设置了错误的 multipart Content-Type | 让浏览器为 FormData 自动生成 boundary |
| Turnstile 一直失败 | Sitekey/Secret、action 或 hostname 不匹配 | 按同一 widget 逐项核对 |
| 第一次失败后无法重试 | 继续使用已消费的 Token | 失败后执行 `turnstile.reset()` |
| 本地请求返回 403 | 请求缺少同源 Origin | 使用真实页面流程或正确测试 Header |
| 图纸在前端被允许、后端拒绝 | `accept` 与服务器白名单不同 | 前后端共享同一格式配置 |
| 邮件报超限 | 忽略 MIME 编码和正文开销 | 降低原始附件总上限 |
| 图纸名乱码或重名 | 文件名清洗后字符丢失 | 加序号、哈希或 Submission ID 前缀 |
| 邮件显示成功但未收到 | `messageId` 只表示服务已接受 | 检查发送日志、退信和收件箱 |
| 用户重试产生两封邮件 | 没有服务器端幂等存储 | KV/D1 按 Submission ID 去重 |
| 快速填写被拒绝 | 3 秒时间规则误伤或本机时钟偏差 | 只把时间作为弱信号 |
| 页面一直停在 Sending | fetch 或邮件调用没有合理超时 | 增加 AbortController 和恢复流程 |
| 有 dataLayer 但 Ads 没请求 | gtag 使用了普通 Array | 恢复 `dataLayer.push(arguments)` |
| Conversion ID 正确仍不计数 | Label 属于另一条转化操作 | 从同一 Ads action 重新复制 ID/Label |
| 同一询盘出现两个转化 | 直接 gtag 与 GTM 重复配置 | 明确唯一标签所有者 |
| 标签显示 loaded 但没有命中 | loaded 只代表脚本加载 | 用 Network 和 Tag Assistant 验证 |
| 智能出价后展现骤降 | Primary 信号无数据、错误或太稀疏 | 先修复测量并积累稳定真实信号 |
| 邮箱点击比 RFQ 多很多 | 邮箱点击误设为 Primary | RFQ Primary，点击意向 Secondary |
| 测试站污染生产数据 | ID/Label 存在硬编码生产默认值 | 分环境配置并在构建时强校验 |
| 欧洲流量合规不足 | 把表单 consent 当成 Consent Mode | 单独实现 CMP 与 Consent Mode v2 |
| 附件扩展名正常但仍有风险 | 没有内容识别和恶意扫描 | 对象存储隔离、扫描后再交付 |

---

## 十七、下一阶段最值得做的升级

如果继续提高这套系统的可靠性，优先级建议如下：

### 第一优先级：服务器幂等

- 由服务器签发 Submission ID；
- KV/D1 保存处理状态；
- 相同 ID 不重复发信；
- 保存 `messageId` 和失败原因。

### 第二优先级：图纸隔离

- 原文件进入对象存储隔离区；
- 计算 SHA-256；
- 文件头和真实内容识别；
- 恶意软件扫描；
- 扫描后生成短期下载链接；
- 邮件不再直接携带高风险原文件。

### 第三优先级：询盘耐久化

不能只依赖邮件。应先把询盘正文和附件状态写入 Durable Store 或 Queue，再异步发邮件。这样即使邮件服务暂时失败，也不会丢失询盘。

### 第四优先级：合格线索回传

当前 Ads Primary 是“服务器接受 RFQ”。下一步可以在 CRM 中继续区分：

```text
RFQ Submitted
→ Sales Accepted Lead
→ Qualified Lead
→ Quote Issued
→ Order Won
```

将真正合格或成交的线索通过 Google Ads 增强型转化或离线转化回传，智能出价才能从“寻找会填表的人”升级为“寻找更可能成交的人”。

### 第五优先级：自动化监控

至少监控：

- RFQ 200/400/403/429/502/503 比例；
- Turnstile 失败原因；
- 邮件无 `messageId`；
- 附件超限；
- fallback tracking 使用率；
- API 成功但浏览器无 conversion 请求；
- Google Ads 转化量与实际邮件量差异。

理想状态应满足：

```text
服务器 accepted=true 的询盘数
≈ 内部系统有效接收数
≈ 去重后的 Google Ads RFQ 转化数
```

三者不必绝对相等，但差异必须能够解释。

---

## 结语

这套系统最重要的不是多安装一个统计脚本，而是重新定义什么才算转化：

> 一个真实转化，是经过安全校验、字段校验、图纸校验、业务接收并具有唯一编号的询盘，而不是一次按钮点击。

Cloudflare 负责保护入口、验证人机、限制滥用和接受询盘邮件；浏览器负责保留点击来源和提供交互体验；Google Ads 只在服务器确认之后收到正式转化。

当图纸、Submission ID、内部邮件和 Ads Transaction ID 能够互相对应时，广告数据才具有业务意义，自动出价才有可能真正优化到高质量询盘，而不是优化到“看起来很热闹”的点击和表单动作。
