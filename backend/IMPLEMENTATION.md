# 后端实现文档

## 概述

这是一个为老年人设计的政府援助申报辅助系统的后端实现。系统使用 **Gemini 1.5 Flash AI** 进行自然语言交互，支持多语言（中文、马来语、英文），并通过状态机管理对话流程。

---

## 核心架构

```
backend/
├── ai-service.ts           # Gemini API 集成层
├── prompts.ts              # 多语言 Prompt 系统
├── form-matcher.ts         # 表格规则匹配引擎
├── types.ts                # TypeScript 类型定义
├── fill/
│   ├── chatbot.ts          # Fill 工作流 Chatbot（已改造）
│   └── session-manager.ts  # 用户会话管理
├── reports.ts              # 表格库（原有）
├── pdf.ts                  # PDF 处理（原有）
└── storage.ts              # 存储助手（原有）

app/api/fill/
├── chat/route.ts           # 处理用户消息和音频
├── session/route.ts        # 初始化会话
├── forms/search/route.ts   # 搜索表格
├── forms/[formId]/route.ts # 获取表格详情
└── complete/route.ts       # 完成流程
```

---

## 关键概念

### 1. 对话状态机 (Dialog State Machine)

系统维护以下 7 个状态的转换：

```
INIT → GATHER_PROFILE → FORM_MATCHING → FORM_EXPLANATION 
     → FORM_FILLING → CONFIRM_TERMS → COMPLETED
```

| 状态 | 含义 | AI 任务 |
|------|------|--------|
| **INIT** | 初始化 | 欢迎用户，收集电话号码和语言选择 |
| **GATHER_PROFILE** | 采集资料 | 逐个询问基础信息（姓名、年龄、地址等） |
| **FORM_MATCHING** | 匹配表格 | 检索符合用户资料的政府表格 |
| **FORM_EXPLANATION** | 解释表格 | 用简单语言解释表格条件和要求 |
| **FORM_FILLING** | 填充字段 | 根据表格字段定义逐个提问 |
| **CONFIRM_TERMS** | 确认条款 | 让用户同意相关免责声明 |
| **COMPLETED** | 完成 | 总结数据，触发后续通知（短信、志愿者） |

### 2. 结构化 JSON 输出

Gemini 被配置为返回标准 JSON 格式：

```json
{
  "reply_to_user": "爷爷，我记下了。那请问您住在哪个 Taman 呢？",
  "extracted_data": {
    "name": "王大明",
    "age": 72
  },
  "next_state": "GATHER_PROFILE",
  "confidence": "High",
  "needs_clarification": false,
  "clarification_field": null
}
```

### 3. 用户会话持久化

每个用户会话存储为 JSON 文件：

```typescript
{
  sessionId: string;              // 唯一标识
  phone: string;                  // 用户电话
  language: Language;             // 语言选择
  state: DialogState;             // 当前状态
  userProfile: UserProfile;       // 采集的用户资料
  collectedData: Record<string, any>;  // 表格字段数据
  messages: Message[];            // 完整对话历史
  consentTerms: boolean;          // 是否同意条款
  createdAt: number;              // 创建时间
  updatedAt: number;              // 更新时间
}
```

会话文件存储在 `storage/pvc/sessions/` 目录。

### 4. 表格库与规则匹配

系统内置 **3 个示例表格**：

1. **单亲家庭补助 (SPA)** - 为单亲家庭提供补助
2. **失业援助 (UA)** - 为失业者提供临时援助
3. **儿童养育补助 (CCA)** - 为多子女低收入家庭提供补助

每个表格包含：
- 资格条件（年龄范围、婚姻状况、收入上限等）
- 必需字段列表
- 多语言本地化文本
- 免责声明

匹配引擎根据用户资料计算与每个表格的匹配分数（0-100）。

---

## API 端点

### 1. 初始化会话
```
POST /api/fill/session
Content-Type: application/json

{
  "phone": "0123456789",
  "language": "zh_CN"  // 可选，默认 zh_CN
}

Response:
{
  "sessionId": "session_0123456789_1718617200000",
  "isNew": true,
  "state": "INIT",
  "language": "zh_CN"
}
```

### 2. 发送用户消息（文本）
```
POST /api/fill/chat
Content-Type: application/json

{
  "sessionId": "session_0123456789_1718617200000",
  "message": "我叫王大明",
  "language": "zh_CN"
}

Response:
{
  "sessionId": "session_0123456789_1718617200000",
  "reply": "好的爷爷，我记下您的名字叫王大明。那请问您今年多少岁呢？",
  "newState": "GATHER_PROFILE",
  "extractedData": { "name": "王大明" },
  "confidence": "High"
}
```

### 3. 发送用户消息（音频）
```
POST /api/fill/chat
Content-Type: application/json

{
  "sessionId": "session_0123456789_1718617200000",
  "audioData": {
    "data": "SUQzBAAAAAAAI1NTVVNcw==...",  // Base64 音频数据
    "mimeType": "audio/wav"
  },
  "language": "zh_CN"
}

Response: 同上
```

### 4. 搜索匹配的表格
```
POST /api/fill/forms/search
Content-Type: application/json

{
  "sessionId": "session_0123456789_1718617200000"
}

Response:
{
  "sessionId": "session_0123456789_1718617200000",
  "forms": [
    {
      "formId": "form_spa",
      "name": "单亲家庭补助金",
      "description": "为符合条件的单亲家庭提供月度补助",
      "matchScore": 95,
      "qualificationsMet": true,
      "keyQualifications": [
        "maritalStatus: single,divorced,widowed",
        "minChildren: 1",
        "maxHouseholdIncome: 5000"
      ],
      "missingFieldsCount": 0
    }
  ],
  "totalMatches": 2,
  "recommendation": "form_spa"
}
```

### 5. 获取表格详情
```
GET /api/fill/forms/form_spa?sessionId=session_0123456789_1718617200000

Response:
{
  "formId": "form_spa",
  "name": "单亲家庭补助金",
  "description": "为符合条件的单亲家庭提供每月补助",
  "qualifications": { ... },
  "requiredFields": [
    {
      "id": "name",
      "name": "name",
      "type": "text",
      "label": "全名",
      "required": true
    },
    ...
  ],
  "disclaimers": [
    "提供的所有信息必须真实准确",
    ...
  ]
}
```

### 6. 完成流程
```
POST /api/fill/complete
Content-Type: application/json

{
  "sessionId": "session_0123456789_1718617200000"
}

Response:
{
  "sessionId": "session_0123456789_1718617200000",
  "status": "completed",
  "phone": "0123456789",
  "collectedData": { ... },
  "messageCount": 24,
  "completedAt": "2024-06-18T12:34:56.000Z"
}
```

---

## 环境变量配置

复制 `.env.example` 为 `.env.local`，填入必需的值：

```bash
# 必需
GEMINI_API_KEY=your_gemini_api_key_here

# 可选（短信集成）
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# 可选（日志等）
LOG_LEVEL=info
```

获取 Gemini API Key：
1. 访问 https://aistudio.google.com/app/apikeys
2. 创建新的 API Key
3. 复制到 `.env.local`

---

## 多语言支持

系统支持三种语言，可通过 `language` 参数选择：

| 代码 | 语言 | 备注 |
|------|------|------|
| `zh_CN` | 简体中文 | 默认 |
| `ms_MY` | 马来语 | 适配马来西亚 |
| `en_US` | 英文 | 备选 |

每个表格都有对应语言的本地化文本。可在 `backend/form-matcher.ts` 中扩展新的语言和表格。

---

## 实现细节

### Gemini 调用

在 `backend/ai-service.ts` 中：

```typescript
const response = await geminiAIService.callGemini(
  messages,           // GeminiMessage[]
  language,           // Language
  state,              // DialogState
  context             // 会话上下文
);
```

**特点**：
- 强制 JSON 响应格式（通过 `response_mime_type: "application/json"`）
- 音频处理（转文字 + 理解）
- 完整的 System Prompt 和状态特定 Prompt
- 模拟响应（当 API Key 不存在时）

### 表格规则匹配

在 `backend/form-matcher.ts` 中：

```typescript
const matches = FormMatcher.matchForms(userProfile);
// 返回按匹配分数排序的表格列表
```

**匹配算法**：
- 年龄：30 分（必须符合范围，否则返回 0）
- 婚姻状况：20 分（硬性要求）
- 子女数量：20 分（硬性要求）
- 家庭收入：20 分（硬性要求）
- 信息完整度：10 分

### 会话管理

在 `backend/fill/session-manager.ts` 中：

```typescript
// 创建
const session = await SessionManager.createSession(phone, language);

// 获取
const session = await SessionManager.getSession(sessionId);

// 更新
await SessionManager.updateProfile(sessionId, { name: "..." });
await SessionManager.addMessage(sessionId, message);

// 完成
await SessionManager.completeSession(sessionId);
```

会话数据以 JSON 文件形式存储在 `storage/pvc/sessions/`，便于后续数据库迁移。

---

## 前端集成指南

### 1. 初始化
```typescript
// 初始化会话
const sessionRes = await fetch('/api/fill/session', {
  method: 'POST',
  body: JSON.stringify({ phone: '0123456789', language: 'zh_CN' })
});
const { sessionId } = await sessionRes.json();
```

### 2. 发送文本消息
```typescript
const chatRes = await fetch('/api/fill/chat', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    message: userInput,
    language: 'zh_CN'
  })
});
const { reply, newState } = await chatRes.json();
```

### 3. 发送语音消息
```typescript
// 获取音频 Blob（来自 VoiceComposer）
const audioBlob = ...; // 用户录音
const base64Audio = await blobToBase64(audioBlob);

const chatRes = await fetch('/api/fill/chat', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    audioData: {
      data: base64Audio,
      mimeType: 'audio/wav'  // 或 audio/webm
    },
    language: 'zh_CN'
  })
});
```

### 4. 搜索表格
```typescript
const formRes = await fetch('/api/fill/forms/search', {
  method: 'POST',
  body: JSON.stringify({ sessionId })
});
const { forms, recommendation } = await formRes.json();
```

### 5. 获取表格详情
```typescript
const detailRes = await fetch(
  `/api/fill/forms/${formId}?sessionId=${sessionId}`
);
const formDetails = await detailRes.json();
```

---

## 开发与测试

### 本地运行

```bash
# 安装依赖
npm install

# 设置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 GEMINI_API_KEY

# 启动开发服务器
npm run dev

# 访问
open http://localhost:8000/fill
```

### 调试技巧

1. **查看会话文件**：检查 `storage/pvc/sessions/` 目录的 JSON 文件
2. **查看完成的会话**：检查 `storage/pvc/sessions_archive/` 目录
3. **启用日志**：设置 `LOG_LEVEL=debug`
4. **模拟响应**：不设置 `GEMINI_API_KEY` 时，系统返回预定义的模拟响应

### 测试场景

1. **完整流程**：从 INIT 到 COMPLETED
2. **多语言切换**：测试 zh_CN、ms_MY、en_US
3. **音频处理**：上传 WAV/WebM 格式音频
4. **表格匹配**：验证不同用户资料的匹配分数

---

## 后续改进与扩展

### 现在已实现 ✅
- Gemini API 集成
- 状态机架构
- 多语言支持
- 音频识别
- 会话持久化
- 表格匹配
- 3 个示例表格

### 建议添加 (Hackathon 后续)
- [ ] 实际 SMS 集成（AWS SNS / Twilio）
- [ ] 数据库持久化（PostgreSQL）
- [ ] PDF 生成与填充
- [ ] 志愿者管理后台
- [ ] 进度跟踪与通知
- [ ] 数据加密与隐私保护
- [ ] 生产环境部署（Kubernetes）
- [ ] 性能优化与缓存

---

## 常见问题 (FAQ)

**Q: 如何添加新的政府表格？**
A: 编辑 `backend/form-matcher.ts`，按照现有表格格式在 `FORMS_DATABASE` 中添加新表格。

**Q: 如何修改 AI 的回复风格？**
A: 编辑 `backend/prompts.ts` 中的 `SYSTEM_PROMPTS` 和状态特定提示词。

**Q: 音频支持哪些格式？**
A: Gemini 3 支持 WAV、MP3、WebM 等。前端 `VoiceComposer` 需要配置为录制相应格式。

**Q: 会话数据会被删除吗？**
A: 默认保留 30 天，可通过 `SessionManager.cleanupExpiredSessions()` 手动清理。

**Q: 支持哪些数据库？**
A: 现在使用本地 JSON 文件，建议后期迁移至 PostgreSQL。

---

## 支持与反馈

如有问题或建议，请联系团队。

---

**最后更新**: 2024-06-18
**版本**: 1.0.0-beta
