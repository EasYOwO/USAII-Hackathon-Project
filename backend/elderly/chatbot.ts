import { geminiAIService, isGeminiConfigured } from '@/backend/ai-service';
import {
  buildApplicationPackage,
  searchAssistanceForms,
  type ApplicantProfile,
  type ApplicationPackage,
  type AssistantLanguage,
  type SearchResult,
} from '@/backend/elderly/forms';

export type ElderlyPhase =
  | 'language'
  | 'collect'
  | 'confirmName'
  | 'confirmAddress'
  | 'addressFix'
  | 'searching'
  | 'forms'
  | 'explain'
  | 'apply'
  | 'review'
  | 'consent'
  | 'complete';

export type ElderlyChatMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export type ElderlyChatInput = {
  action?: 'init' | 'message';
  userMessage?: string;
  language: AssistantLanguage;
  phase: ElderlyPhase;
  profile: ApplicantProfile;
  questionIndex: number;
  messages: ElderlyChatMessage[];
  results: SearchResult[];
  selectedFormId?: string | null;
  extraAnswers: Record<string, string>;
  currentApplicationFieldId?: string | null;
  consents: boolean[];
};

export type ElderlyChatOutput = {
  aiEnabled: boolean;
  reply: string;
  profile: ApplicantProfile;
  phase: ElderlyPhase;
  questionIndex: number;
  quickOptions?: Array<{ label: string; storedValue?: string }>;
  widget?: 'forms' | 'review' | 'consent' | 'completion';
  results: SearchResult[];
  selectedFormId?: string | null;
  extraAnswers: Record<string, string>;
  currentApplicationFieldId?: string | null;
  application?: ApplicationPackage | null;
  consents: boolean[];
  shouldSpeak?: boolean;
  error?: string;
};

const profileFieldOrder: Array<keyof ApplicantProfile> = [
  'name',
  'phone',
  'icNumber',
  'age',
  'state',
  'postcode',
  'taman',
  'addressLine',
  'maritalStatus',
  'children',
  'householdIncome',
  'disability',
  'housingStatus',
];

const elderlyResponseSchema = {
  type: 'object',
  properties: {
    reply_to_user: { type: 'string' },
    profile_updates: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        icNumber: { type: 'string' },
        age: { type: 'string' },
        state: { type: 'string' },
        postcode: { type: 'string' },
        taman: { type: 'string' },
        addressLine: { type: 'string' },
        maritalStatus: { type: 'string' },
        children: { type: 'string' },
        householdIncome: { type: 'string' },
        disability: { type: 'string' },
        housingStatus: { type: 'string' },
        medicalNeed: { type: 'string' },
        rentalArrears: { type: 'string' },
      },
      required: [
        'name',
        'phone',
        'icNumber',
        'age',
        'state',
        'postcode',
        'taman',
        'addressLine',
        'maritalStatus',
        'children',
        'householdIncome',
        'disability',
        'housingStatus',
        'medicalNeed',
        'rentalArrears',
      ],
    },
    phase: { type: 'string' },
    question_index: { type: 'integer' },
    quick_options: { type: 'array', items: { type: 'string' } },
    widget: { type: 'string' },
    trigger_search: { type: 'boolean' },
    selected_form_id: { type: 'string' },
    extra_answers: { type: 'object' },
    current_field_id: { type: 'string' },
    toggle_consent_index: { type: 'integer' },
    complete_draft: { type: 'boolean' },
  },
  required: ['reply_to_user', 'profile_updates'],
};

function toGeminiLanguage(language: AssistantLanguage) {
  return language === 'zh' ? 'zh_CN' : 'en_US';
}

function buildSystemPrompt(input: ElderlyChatInput, selectedForm: SearchResult | null) {
  const languageLabel = input.language === 'zh' ? '华文' : 'English';
  return `You are a warm, patient senior application assistant for Malaysian government assistance forms.
Speak in ${languageLabel}. One simple step at a time. No legal jargon.

Current phase: ${input.phase}
Question index: ${input.questionIndex}
Profile fields order: ${profileFieldOrder.join(', ')}
Current profile JSON: ${JSON.stringify(input.profile)}
Extra answers JSON: ${JSON.stringify(input.extraAnswers)}
Consent flags: ${JSON.stringify(input.consents)}
Available forms: ${JSON.stringify(
    input.results.map((result, index) => ({
      index: index + 1,
      id: result.form.id,
      title: result.form.title,
      status: result.status,
    })),
  )}
Selected form: ${selectedForm ? JSON.stringify({ id: selectedForm.form.id, title: selectedForm.form.title }) : 'none'}
Current application field id: ${input.currentApplicationFieldId ?? 'none'}

Rules:
- Guide the senior through collecting profile fields, confirming name/address, matching forms, explaining a form, filling missing fields, review, consent, and completion.
- Whenever the user gives personal details, put every extracted profile value in profile_updates using the exact profile field keys.
- profile_updates must include all profile keys every time; use an empty string for unknown fields.
- Do not only mention recorded details in reply_to_user; the same values must be present in profile_updates so the application state updates.
- Put application-only answers in extra_answers.
- Use quick_options for tap choices when helpful.
- Set widget to forms, review, consent, or completion when the UI should show that block.
- Set trigger_search true only after all profile fields are collected and confirmed.
- Set complete_draft true only when all consents are accepted and user agrees to finish.
- Always return JSON only with reply_to_user and any changed fields.`;
}

function mergeProfile(profile: ApplicantProfile, updates: Record<string, unknown> | undefined) {
  if (!updates) return profile;
  const next = { ...profile };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (!text) continue;
    if (key in next || profileFieldOrder.includes(key as keyof ApplicantProfile)) {
      (next as Record<string, string>)[key] = text;
    }
  }
  return next;
}

function nextMissingProfileIndex(profile: ApplicantProfile) {
  return profileFieldOrder.findIndex((field) => !profile[field]?.trim());
}

function mapQuickOptions(options: unknown) {
  if (!Array.isArray(options)) return undefined;
  return options
    .map((option) => String(option).trim())
    .filter(Boolean)
    .map((label) => ({ label, storedValue: label }));
}

function mapWidget(widget: unknown): ElderlyChatOutput['widget'] {
  if (widget === 'forms' || widget === 'review' || widget === 'consent' || widget === 'completion') {
    return widget;
  }
  return undefined;
}

export async function processElderlyChat(input: ElderlyChatInput): Promise<ElderlyChatOutput> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key is not configured');
  }

  const selectedForm =
    input.results.find((result) => result.form.id === input.selectedFormId) ??
    input.results[0] ??
    null;

  const userMessage =
    input.action === 'init'
      ? input.language === 'zh'
        ? '请开始长者申请助手对话。'
        : 'Please start the senior application assistant conversation.'
      : input.userMessage?.trim() ?? '';

  if (!userMessage) {
    return {
      aiEnabled: true,
      reply: input.language === 'zh' ? '请输入您的回复。' : 'Please enter your reply.',
      profile: input.profile,
      phase: input.phase,
      questionIndex: input.questionIndex,
      results: input.results,
      selectedFormId: input.selectedFormId ?? null,
      extraAnswers: input.extraAnswers,
      currentApplicationFieldId: input.currentApplicationFieldId ?? null,
      consents: input.consents,
    };
  }

  const history = input.messages.slice(-12).map((message) => ({
    role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: message.content }],
  }));

  const aiRaw = await geminiAIService.callGeminiElderly(
    buildSystemPrompt(input, selectedForm),
    [
      ...history,
      {
        role: 'user',
        parts: [{ text: userMessage }],
      },
    ],
    elderlyResponseSchema,
  );

  let profile = mergeProfile(input.profile, aiRaw.profile_updates as Record<string, unknown> | undefined);
  let phase = (typeof aiRaw.phase === 'string' ? aiRaw.phase : input.phase) as ElderlyPhase;
  let questionIndex = typeof aiRaw.question_index === 'number' ? aiRaw.question_index : input.questionIndex;
  let results = input.results;
  let selectedFormId = typeof aiRaw.selected_form_id === 'string' ? aiRaw.selected_form_id : input.selectedFormId ?? null;
  let extraAnswers = {
    ...input.extraAnswers,
    ...(aiRaw.extra_answers as Record<string, string> | undefined),
  };
  let currentApplicationFieldId =
    typeof aiRaw.current_field_id === 'string' ? aiRaw.current_field_id : input.currentApplicationFieldId ?? null;
  let consents = [...input.consents];
  let application: ApplicationPackage | null = null;
  let widget = mapWidget(aiRaw.widget);

  if (typeof aiRaw.toggle_consent_index === 'number' && aiRaw.toggle_consent_index >= 0) {
    consents[aiRaw.toggle_consent_index] = !consents[aiRaw.toggle_consent_index];
  }

  if (aiRaw.trigger_search === true || (phase === 'searching' && results.length === 0)) {
    phase = 'searching';
    results = searchAssistanceForms(profile, input.language);
    selectedFormId = results[0]?.form.id ?? null;
    phase = 'forms';
    widget = results.length > 0 ? 'forms' : undefined;
  }

  const selectedResult = results.find((result) => result.form.id === selectedFormId) ?? results[0] ?? null;

  if (selectedResult && (phase === 'review' || phase === 'consent' || phase === 'complete' || aiRaw.complete_draft === true)) {
    application = buildApplicationPackage({
      formId: selectedResult.form.id,
      profile,
      extraAnswers,
      consents,
      language: input.language,
    });
  }

  if (phase === 'collect' && nextMissingProfileIndex(profile) >= 0) {
    questionIndex = nextMissingProfileIndex(profile);
  }

  return {
    aiEnabled: true,
    reply: String(aiRaw.reply_to_user ?? ''),
    profile,
    phase,
    questionIndex,
    quickOptions: mapQuickOptions(aiRaw.quick_options),
    widget,
    results,
    selectedFormId,
    extraAnswers,
    currentApplicationFieldId,
    application,
    consents,
    shouldSpeak: true,
  };
}

export { isGeminiConfigured };
