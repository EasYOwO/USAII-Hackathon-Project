import { answerElderlyQuestion, answerElderlyQuestionWithAI } from '@/backend/elderly/ask';
import { isGeminiConfigured } from '@/backend/elderly/chatbot';
import { isGeminiUnavailableError } from '@/backend/ai-service';
import type { ApplicantProfile, AssistantLanguage } from '@/backend/elderly/forms';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    language?: AssistantLanguage;
    phase?: string;
    lastAssistantMessage?: string;
    profile?: ApplicantProfile;
  };

  const language = body.language === 'en' ? 'en' : 'zh';
  const question = body.question?.trim();

  if (!question) {
    return Response.json(
      { error: language === 'zh' ? '请输入您的问题。' : 'Please enter your question.' },
      { status: 400 },
    );
  }

  const profileSummary = body.profile
    ? Object.entries(body.profile)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    : '';

  const context = {
    phase: body.phase,
    lastAssistantMessage: body.lastAssistantMessage,
    profileSummary,
  };

  if (isGeminiConfigured()) {
    try {
      const answer = await answerElderlyQuestionWithAI(question, language, context);
      return Response.json({ answer, aiEnabled: true });
    } catch (error) {
      if (isGeminiUnavailableError(error)) {
        console.warn('Gemini elderly question answering unavailable; using local fallback answer.', error);
        return Response.json({ answer: answerElderlyQuestion(question, language, context), aiEnabled: false });
      }

      const message = error instanceof Error ? error.message : 'Gemini request failed';
      return Response.json(
        {
          error: language === 'zh' ? `AI 暂时无法回应，请稍后再试。（${message}）` : `AI is temporarily unavailable. (${message})`,
          aiEnabled: true,
        },
        { status: 502 },
      );
    }
  }

  const answer = answerElderlyQuestion(question, language, context);
  return Response.json({ answer, aiEnabled: false });
}
