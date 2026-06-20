import { sendSmsMessage } from '@/backend/notifications';
import type { AssistantLanguage } from '@/backend/elderly/forms';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    phone?: string;
    language?: AssistantLanguage;
    referenceId?: string;
    formTitle?: string;
    smsMessage?: string;
  };

  const phone = body.phone?.trim();
  if (!phone) {
    return Response.json({ error: 'phone is required' }, { status: 400 });
  }

  const language: AssistantLanguage = body.language === 'zh' ? 'zh' : 'en';
  const fallback =
    language === 'zh'
      ? `您的申请草稿已完成。编号：${body.referenceId ?? '-'}。`
      : `Your application draft is complete. Reference: ${body.referenceId ?? '-'}.`;
  const message = body.smsMessage?.trim() || fallback;
  const sent = await sendSmsMessage(phone, message);

  return Response.json({
    ok: sent,
    phone,
    referenceId: body.referenceId ?? null,
    formTitle: body.formTitle ?? null,
    message,
  });
}
