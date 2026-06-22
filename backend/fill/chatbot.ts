/**
 * Fill Workflow Chatbot - Refactored Version
 * Now integrated with Gemini AI, multilingual support, and complete state machine
 */

import type {
  ChatResponse,
  DialogState,
  GeminiAIResponse,
  Language as AppLanguage,
  Message,
  UserProfile,
  UserSession,
} from '@/backend/types';
import { geminiAIService, isGeminiConfigured, isGeminiUnavailableError } from '@/backend/ai-service';
import { SessionManager, getSessionContext } from '@/backend/fill/session-manager';
import { FormMatcher } from '@/backend/form-matcher';

// ============== Legacy API Types (maintained for backward compatibility) ==============
export type FillRecord = {
  name: string;
  email: string;
  id: string;
  source: string;
};

export type FillQuestion = {
  id: 'name' | 'email' | 'id';
  label: string;
  options: string[];
};

export type FillInsight = {
  spokenSummary: string;
  highlights: string[];
  missingFields: string[];
  confidence: 'High' | 'Medium' | 'Low';
};

// ============== Legacy API (maintained for frontend compatibility) ==============
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
type LegacyLanguage = 'en' | 'zh';

export function fillQuestions(userName = 'Ali', language: LegacyLanguage = 'en'): FillQuestion[] {
  const safeName = userName.trim() || 'Ali';
  const emailName = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '.');

  if (language === 'zh') {
    return [
      {
        id: 'name',
        label: '表格上应该填写什么姓名？',
        options: [safeName, 'Jonathan', 'Kai'],
      },
      {
        id: 'email',
        label: '应该使用哪一个电邮？',
        options: [`${emailName}@example.com`, 'ali@example.com', '手动输入'],
      },
      {
        id: 'id',
        label: '这份记录要保留哪一个 ID？',
        options: ['1234567', '之后再使用员工 ID', '没有资料'],
      },
    ];
  }

  return [
    {
      id: 'name',
      label: 'What name should I put in the form?',
      options: [safeName, 'Jonathan', 'Kai'],
    },
    {
      id: 'email',
      label: 'Which email should I use?',
      options: [`${emailName}@example.com`, 'ali@example.com', 'manual input'],
    },
    {
      id: 'id',
      label: 'Which ID should I keep for this record?',
      options: ['1234567', 'Use employee ID later', 'Not available'],
    },
  ];
}

export function fillFromMessage(message: string, language: LegacyLanguage = 'en'): FillRecord {
  const email = message.match(emailPattern)?.[0] ?? 'ali@example.com';
  const name = /\bali\b/i.test(message) ? 'Ali' : 'Ali';
  const id = message.match(/\b\d{5,12}\b/)?.[0] ?? '1234567';

  return {
    name,
    email,
    id,
    source: language === 'zh' ? '填写聊天助手后端占位资料' : 'Fill chatbot backend placeholder',
  };
}

export function fillFromAnswers(answers: Partial<Record<FillQuestion['id'], string>>, language: LegacyLanguage = 'en'): FillRecord {
  const name = answers.name?.trim() || 'Ali';
  const emailCandidate = answers.email?.trim() || '';
  const idCandidate = answers.id?.trim() || '';

  return {
    name,
    email: emailCandidate.match(emailPattern)?.[0] ?? `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`,
    id: idCandidate.match(/\b\d{5,12}\b/)?.[0] ?? '1234567',
    source: language === 'zh' ? '填写聊天助手所选答案' : 'Fill chatbot selected answers',
  };
}

export function fillReply(record: FillRecord, language: LegacyLanguage = 'en') {
  if (language === 'zh') {
    return `我已把草稿填好：姓名 ${record.name}，电邮 ${record.email}，ID ${record.id}。`;
  }
  return `I filled the draft with name ${record.name}, email ${record.email}, and ID ${record.id}.`;
}

const fillFallbackFields = ['name', 'email', 'id'] as const;

function legacyLanguageFromApp(language: AppLanguage): LegacyLanguage {
  return language === 'zh_CN' ? 'zh' : 'en';
}

function isGreetingMessage(message: string) {
  return /^(hi|hello|hey|你好|您好|salam|halo)\b/i.test(message.trim()) || message.includes('进入网站');
}

function fillFallbackPrompt(field: (typeof fillFallbackFields)[number], language: LegacyLanguage) {
  if (language === 'zh') {
    const prompts = {
      name: '表格上应该填写什么姓名？',
      email: '应该使用哪一个电邮？',
      id: '这份记录要保留哪一个 ID？',
    };
    return prompts[field];
  }

  const prompts = {
    name: 'What name should I put in the form?',
    email: 'Which email should I use?',
    id: 'Which ID should I keep for this record?',
  };
  return prompts[field];
}

async function processUserMessageFallback(session: UserSession, userMessage: string): Promise<ChatResponse> {
  const language = legacyLanguageFromApp(session.language);
  const collected = { ...session.collectedData } as Partial<Record<(typeof fillFallbackFields)[number], string>>;
  const firstMissing = fillFallbackFields.find((field) => !collected[field]?.trim());

  if (firstMissing && userMessage.trim() && !isGreetingMessage(userMessage)) {
    collected[firstMissing] = userMessage.trim();
  }

  const nextMissing = fillFallbackFields.find((field) => !collected[field]?.trim());
  const record = fillFromAnswers(collected, language);
  const reply = nextMissing ? fillFallbackPrompt(nextMissing, language) : fillReply(record, language);
  const newState: DialogState = nextMissing ? 'GATHER_PROFILE' : 'COMPLETED';
  const extractedData = nextMissing ? collected : record;

  await SessionManager.updateCollectedData(session.sessionId, collected);
  await SessionManager.updateState(session.sessionId, newState, userMessage, reply);

  return {
    sessionId: session.sessionId,
    reply,
    newState,
    extractedData,
    confidence: nextMissing ? 'Medium' : 'High',
  };
}

export function buildFillInsight(record: FillRecord, messages: string[] = [], language: LegacyLanguage = 'en'): FillInsight {
  const missingFields = [
    record.name ? '' : 'Name',
    record.email ? '' : 'Email',
    record.id ? '' : 'ID',
  ].filter(Boolean);
  const lastRequest = messages.filter(Boolean).at(-1) ?? 'the latest fill request';

  if (language === 'zh') {
    return {
      spokenSummary: `简单说明：我找到的姓名是 ${record.name || '未提供'}，电邮是 ${record.email || '未提供'}，ID 是 ${record.id || '未提供'}。最后一次请求是「${lastRequest}」。`,
      highlights: [
        `姓名设为 ${record.name || '未提供'}。`,
        `电邮设为 ${record.email || '未提供'}。`,
        `ID 设为 ${record.id || '未提供'}。`,
        '这些资料已经可以进入表格复核步骤。',
      ],
      missingFields,
      confidence: missingFields.length === 0 ? 'High' : 'Medium',
    };
  }

  return {
    spokenSummary: `Here is the short explanation. I found ${record.name || 'a person'}, matched the email as ${record.email || 'not provided'}, and kept the ID as ${record.id || 'not provided'}. The latest request was "${lastRequest}".`,
    highlights: [
      `Name is set to ${record.name || 'not available'}.`,
      `Email is set to ${record.email || 'not available'}.`,
      `ID is set to ${record.id || 'not available'}.`,
      'The extracted values are ready for the table review step.',
    ],
    missingFields,
    confidence: missingFields.length === 0 ? 'High' : 'Medium',
  };
}

// ============== New AI-Driven API ==============

/**
 * 处理文本消息（支持新的 Gemini 集成）
 */
export async function processUserMessage(
  sessionId: string,
  userMessage: string,
  language: AppLanguage = 'zh_CN',
): Promise<ChatResponse> {
  // Get or create session
  let session = await SessionManager.getSession(sessionId);

  if (!session) {
    // Extract phone from sessionId (format: session_<phone>_<timestamp>)
    const phoneMatch = sessionId.match(/session_(.+)_\d+/);
    const phone = phoneMatch?.[1] || 'unknown';
    session = await SessionManager.createSession(phone, language, sessionId);
  }

  // Get message history for AI context
  const messageHistory = await SessionManager.getMessageHistory(sessionId, 10);
  const geminiMessages: Parameters<typeof geminiAIService.callGemini>[0] = messageHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Get session context
  const sessionContext = getSessionContext(session);

  // Call Gemini AI, or continue with the local field-by-field algorithm if AI is unavailable.
  if (!isGeminiConfigured()) {
    return processUserMessageFallback(session, userMessage);
  }

  let aiResponse: GeminiAIResponse;
  try {
    aiResponse = await geminiAIService.callGemini(
      [
        ...geminiMessages,
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      session.language,
      session.state,
      sessionContext,
    );
  } catch (error) {
    if (isGeminiUnavailableError(error)) {
      console.warn('Gemini fill chat unavailable; using local fallback algorithm.', error);
      return processUserMessageFallback(session, userMessage);
    }
    throw error;
  }

  // Update user profile
  if (Object.keys(aiResponse.extracted_data).length > 0) {
    await SessionManager.updateProfile(sessionId, aiResponse.extracted_data as Partial<UserProfile>);
  }

  // Add message to history
  await SessionManager.addMessage(sessionId, {
    role: 'user',
    content: userMessage,
  });

  await SessionManager.addMessage(sessionId, {
    role: 'assistant',
    content: aiResponse.reply_to_user,
  });

  // Get updated session
  session = (await SessionManager.getSession(sessionId))!;

  // Return chat response
  return {
    sessionId,
    reply: aiResponse.reply_to_user,
    newState: (aiResponse.next_state as DialogState) || session.state,
    extractedData: aiResponse.extracted_data as Partial<UserProfile>,
    confidence: aiResponse.confidence || 'Medium',
  };
}

/**
 * 处理音频消息（语音转文字 + AI 理解）
 */
export async function processAudioMessage(
  sessionId: string,
  audioData: string, // Base64
  mimeType: string,
  language: AppLanguage = 'zh_CN',
): Promise<ChatResponse> {
  let session = await SessionManager.getSession(sessionId);

  if (!session) {
    const phoneMatch = sessionId.match(/session_(.+)_\d+/);
    const phone = phoneMatch?.[1] || 'unknown';
    session = await SessionManager.createSession(phone, language);
  }

  const messageHistory = await SessionManager.getMessageHistory(sessionId, 10);
  const geminiMessages: Parameters<typeof geminiAIService.callGemini>[0] = messageHistory.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const sessionContext = getSessionContext(session);

  // Call Gemini to process audio
  const aiResponse = await geminiAIService.processAudioMessage(
    audioData,
    mimeType,
    session.language,
    geminiMessages,
    session.state,
    sessionContext,
  );

  // Update state
  if (Object.keys(aiResponse.extracted_data).length > 0) {
    await SessionManager.updateProfile(sessionId, aiResponse.extracted_data as Partial<UserProfile>);
  }

  await SessionManager.addMessage(sessionId, {
    role: 'assistant',
    content: aiResponse.reply_to_user,
  });

  session = (await SessionManager.getSession(sessionId))!;

  return {
    sessionId,
    reply: aiResponse.reply_to_user,
    newState: (aiResponse.next_state as DialogState) || session.state,
    extractedData: aiResponse.extracted_data as Partial<UserProfile>,
    confidence: aiResponse.confidence || 'Medium',
  };
}

/**
 * 在用户选择表格后，获取匹配的表格列表
 */
export async function findMatchingForms(sessionId: string) {
  const session = await SessionManager.getSession(sessionId);
  if (!session) return [];

  return FormMatcher.matchForms(session.userProfile);
}

/**
 * 完成会话
 */
export async function completeSession(sessionId: string): Promise<void> {
  await SessionManager.completeSession(sessionId);
}
