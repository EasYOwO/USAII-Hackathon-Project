import { searchAssistanceForms, type ApplicantProfile, type AssistantLanguage } from '@/backend/elderly/forms';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    language?: AssistantLanguage;
    profile?: ApplicantProfile;
    situation?: string;
  };

  const language: AssistantLanguage = body.language === 'zh' ? 'zh' : 'en';

  return Response.json({
    language,
    matchingMethod: {
      label: 'AI-assisted screening',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      guardrail: 'Local eligibility rules are used to check age, income, household, housing, and document conditions.',
    },
    results: searchAssistanceForms(body.profile ?? {}, language, body.situation),
  });
}
