/**
 * 获取表格详情 API
 * GET /api/fill/forms/[formId]
 * 获取特定表格的完整信息
 */

import { SessionManager } from '@/backend/fill/session-manager';
import { FormMatcher } from '@/backend/form-matcher';
import type { Language } from '@/backend/types';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { formId: string } },
) {
  try {
    const { formId } = params;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!formId) {
      return Response.json({ error: 'formId is required' }, { status: 400 });
    }

    // Get session to determine language
    let language: Language = 'zh_CN';
    if (sessionId) {
      const session = await SessionManager.getSession(sessionId);
      if (session) {
        language = session.language;
      }
    }

    const form = FormMatcher.getFormById(formId);
    if (!form) {
      return Response.json({ error: 'Form not found' }, { status: 404 });
    }

    // Return localized form information
    const localizedForm = {
      formId: form.id,
      name: form.languages[language]?.name || form.name,
      description: form.languages[language]?.description || form.description,
      qualifications: form.qualifications,
      requiredFields: form.requiredFields.map((field) => ({
        id: field.id,
        name: field.name,
        type: field.type,
        label: field.label,
        required: field.required,
        options: field.options,
      })),
      disclaimers: form.languages[language]?.disclaimers || form.disclaimers,
    };

    return Response.json(localizedForm);
  } catch (error) {
    console.error('Get form details error:', error);
    return Response.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 },
    );
  }
}
