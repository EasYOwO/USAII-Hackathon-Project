import { geminiAIService, isGeminiConfigured } from '@/backend/ai-service';
import type { AssistantLanguage } from '@/backend/elderly/forms';

type AskContext = {
  phase?: string;
  lastAssistantMessage?: string;
  profileSummary?: string;
};

export function answerElderlyQuestion(
  question: string,
  language: AssistantLanguage,
  context: AskContext = {},
): string {
  const normalized = question.trim().toLowerCase();

  if (language === 'zh') {
    if (normalized.includes('收费') || normalized.includes('钱') || normalized.includes('费用')) {
      return '这个申请助手是免费使用的，不会向您收取任何费用。';
    }
    if (normalized.includes('隐私') || normalized.includes('资料') || normalized.includes('安全')) {
      return '您提供的资料只会用于这次聊天流程。临时文件会在流程完成后清除。';
    }
    if (normalized.includes('多久') || normalized.includes('时间') || normalized.includes('几天')) {
      return '草稿完成后的正式处理时间要看相关机构和所选表格。';
    }
    if (normalized.includes('资格') || normalized.includes('符合')) {
      return '我会根据您的情况描述和聊天中提供的资料，帮您找出可能符合的表格。';
    }
    if (context.lastAssistantMessage) {
      return `关于「${context.lastAssistantMessage.slice(0, 40)}」，您可以照上面提示回答。如果不确定，也可以再说一次，我会帮您确认。`;
    }
    return '我在这里帮您。您可以继续回答上面的问题，或告诉我您不明白的地方。';
  }

  if (normalized.includes('fee') || normalized.includes('cost') || normalized.includes('charge')) {
    return 'This assistant is free to use. There is no charge for help with your application draft.';
  }
  if (normalized.includes('privacy') || normalized.includes('data') || normalized.includes('safe')) {
    return 'Your information is only used during this assistance flow. Temporary documents are cleared after the flow is complete.';
  }
  if (normalized.includes('how long') || normalized.includes('time')) {
    return 'After the draft is complete, official processing time depends on the agency and selected form.';
  }
  if (normalized.includes('eligible') || normalized.includes('qualif')) {
    return 'I match forms using your situation description and the details you provide in this chat.';
  }
  if (context.lastAssistantMessage) {
    return `About "${context.lastAssistantMessage.slice(0, 60)}", please follow the prompt above. If you are unsure, say it again and I will help confirm.`;
  }
  return 'I am here to help. You can continue with the question above or tell me what is unclear.';
}

export async function answerElderlyQuestionWithAI(
  question: string,
  language: AssistantLanguage,
  context: AskContext = {},
): Promise<string> {
  if (!isGeminiConfigured()) {
    return answerElderlyQuestion(question, language, context);
  }

  const systemPrompt =
    language === 'zh'
      ? `你是马来西亚长者政府援助申请助手。请用温暖、简单、口语化的华文回答长辈的提问。
不要编造收费信息。不要提到短信或社区核验。回答要短，最多 3 句。`
      : `You are a senior government assistance application helper in Malaysia. Answer warmly and simply in English. Keep answers to at most 3 short sentences.`;

  const userPrompt = [
    context.phase ? `Current step: ${context.phase}` : '',
    context.lastAssistantMessage ? `Last assistant message: ${context.lastAssistantMessage}` : '',
    context.profileSummary ? `Known profile: ${context.profileSummary}` : '',
    `Senior question: ${question}`,
  ]
    .filter(Boolean)
    .join('\n');

  return geminiAIService.generateTextReply(systemPrompt, userPrompt);
}
