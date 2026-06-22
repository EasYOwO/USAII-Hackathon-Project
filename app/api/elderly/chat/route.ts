import {
  isGeminiConfigured,
  processElderlyChat,
  processElderlyChatFallback,
  type ElderlyChatInput,
} from '@/backend/elderly/chatbot';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as ElderlyChatInput & { action?: 'init' | 'message' };
  const language = body.language === 'en' ? 'en' : 'zh';
  const input: ElderlyChatInput = {
    action: body.action ?? 'message',
    userMessage: body.userMessage,
    language,
    phase: body.phase ?? 'collect',
    profile: body.profile ?? {},
    questionIndex: body.questionIndex ?? 0,
    messages: body.messages ?? [],
    results: body.results ?? [],
    selectedFormId: body.selectedFormId ?? null,
    extraAnswers: body.extraAnswers ?? {},
    currentApplicationFieldId: body.currentApplicationFieldId ?? null,
    consents: body.consents ?? [],
  };

  if (!isGeminiConfigured()) {
    return Response.json(processElderlyChatFallback(input));
  }

  try {
    return Response.json(await processElderlyChat(input));
  } catch (error) {
    console.warn('Elderly AI chat failed; using local fallback algorithm.', error);
    return Response.json(processElderlyChatFallback(input));
  }
}
