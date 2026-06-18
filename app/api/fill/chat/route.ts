import {
  fillFromAnswers,
  fillReply,
  processAudioMessage,
  processUserMessage,
} from '@/backend/fill/chatbot';
import type { Language } from '@/backend/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      message?: string;
      answers?: Partial<Record<'name' | 'email' | 'id', string>>;
      audioData?: {
        data: string; // Base64
        mimeType: string;
      };
      language?: Language | 'en' | 'zh';
    };

    const { sessionId, message, audioData } = body;

    if (body.answers) {
      const legacyLanguage = body.language === 'zh' || body.language === 'zh_CN' ? 'zh' : 'en';
      const record = fillFromAnswers(body.answers, legacyLanguage);

      return Response.json({
        reply: fillReply(record, legacyLanguage),
        record,
        extractedData: record,
        confidence: 'High',
      });
    }

    const language: Language =
      body.language === 'ms_MY' ? 'ms_MY' : body.language === 'en_US' || body.language === 'en' ? 'en_US' : 'zh_CN';

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 });
    }

    let result;

    if (audioData?.data) {
      // Handle audio message
      result = await processAudioMessage(sessionId, audioData.data, audioData.mimeType, language);
    } else if (message) {
      // Handle text message
      result = await processUserMessage(sessionId, message, language);
    } else {
      return Response.json(
        { error: 'Either message or audioData is required' },
        { status: 400 }
      );
    }

    return Response.json({
      sessionId: sessionId,
      reply: result.reply,
      newState: result.newState,
      extractedData: result.extractedData, 
      record: result.extractedData,
      confidence: result.confidence
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

