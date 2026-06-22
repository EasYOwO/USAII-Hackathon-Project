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

const profileFieldOrder = [
  'phone',
  'name',
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
] as const satisfies readonly (keyof ApplicantProfile)[];

type ProfileFieldKey = (typeof profileFieldOrder)[number];

function isProfileFieldKey(key: string): key is ProfileFieldKey {
  return (profileFieldOrder as readonly string[]).includes(key);
}

const fallbackFieldPrompts: Record<AssistantLanguage, Record<ProfileFieldKey, string>> = {
  en: {
    phone: 'What phone number should the volunteer use to contact you?',
    name: 'Please tell me your full name.',
    icNumber: 'What is your IC number?',
    age: 'How old are you this year?',
    state: 'Which state do you live in?',
    postcode: 'What is your postcode?',
    taman: 'What is your taman or area name?',
    addressLine: 'Please say your house number and street address.',
    maritalStatus: 'What is your marital status?',
    children: 'How many children or dependants are under your care?',
    householdIncome: 'About how much is your monthly household income?',
    disability: 'Do you have any disability or long-term medical need?',
    housingStatus: 'Do you own, rent, or stay with family?',
  },
  zh: {
    phone: '请问之后志愿者应该用哪一个电话号码联系您？',
    name: '请告诉我您的姓名。',
    icNumber: '请问您的身份证号码是什么？',
    age: '请问您今年几岁？',
    state: '您住在哪一个州属？',
    postcode: '您的邮编是多少？',
    taman: '您的花园或地区名称是什么？',
    addressLine: '请说出您的门牌号码和街道地址。',
    maritalStatus: '请问您的婚姻状况是什么？',
    children: '您照顾的孩子或受扶养人有几位？',
    householdIncome: '每月家庭总收入大概是多少？',
    disability: '是否有残障或长期医疗需要？',
    housingStatus: '您是自住、租屋，还是和家人同住？',
  },
};

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
    if (key in next || isProfileFieldKey(key)) {
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

function foundFormsText(language: AssistantLanguage, count: number) {
  if (language === 'zh') {
    return `我用本地规则筛选出 ${count} 种推荐表格。您可以说号码或点击选择。`;
  }
  return `I found ${count} recommended form types using the local rules. You can say the number or tap one.`;
}

function noFormsText(language: AssistantLanguage) {
  return language === 'zh' ? '目前没有找到合适的表格。' : 'No suitable forms were found right now.';
}

function idCaptureIntroText(language: AssistantLanguage) {
  return language === 'zh'
    ? '现在请拍摄身份证的正面和背面。系统会自动把两张照片转换成 PDF。'
    : 'Now please photograph the front and back of your ID. The system will automatically convert both photos into a PDF.';
}

function reviewReadyText(language: AssistantLanguage) {
  return language === 'zh'
    ? '申请草稿准备好了。请检查资料是否正确。'
    : 'The draft is ready. Please check whether the details are correct.';
}

function continueSignal(message: string) {
  return /checked answers are correct|please continue with the next question/i.test(message);
}

function selectResultFromMessage(message: string, results: SearchResult[]) {
  const normalized = message.trim().toLowerCase();
  const numericChoice = normalized.match(/\b\d+\b/)?.[0];
  if (numericChoice) {
    const index = Number.parseInt(numericChoice, 10) - 1;
    if (results[index]) return results[index];
  }

  return (
    results.find((result) => result.form.id.toLowerCase() === normalized) ??
    results.find((result) => result.form.title.toLowerCase() === normalized) ??
    results.find((result) => normalized.includes(result.form.title.toLowerCase())) ??
    null
  );
}

function selectedResultFromState(results: SearchResult[], selectedFormId?: string | null) {
  return results.find((result) => result.form.id === selectedFormId) ?? results[0] ?? null;
}

function fallbackBase(input: ElderlyChatInput, overrides: Partial<ElderlyChatOutput>): ElderlyChatOutput {
  return {
    aiEnabled: false,
    reply: '',
    profile: input.profile,
    phase: input.phase,
    questionIndex: input.questionIndex,
    results: input.results,
    selectedFormId: input.selectedFormId ?? null,
    extraAnswers: input.extraAnswers,
    currentApplicationFieldId: input.currentApplicationFieldId ?? null,
    consents: input.consents,
    shouldSpeak: true,
    ...overrides,
  };
}

export function processElderlyChatFallback(input: ElderlyChatInput): ElderlyChatOutput {
  let profile = { ...input.profile };
  let results = input.results;
  let selectedFormId = input.selectedFormId ?? null;
  let extraAnswers = { ...input.extraAnswers };
  let currentApplicationFieldId = input.currentApplicationFieldId ?? null;
  const consents = [...input.consents];
  const userMessage = input.action === 'init' ? '' : input.userMessage?.trim() ?? '';

  if (input.action === 'init' || input.phase === 'collect' || input.phase === 'searching') {
    if (input.action === 'message' && userMessage && !continueSignal(userMessage)) {
      const indexedField = profileFieldOrder[input.questionIndex];
      const missingIndex = nextMissingProfileIndex(profile);
      const targetField =
        indexedField && !profile[indexedField]?.trim()
          ? indexedField
          : missingIndex >= 0
            ? profileFieldOrder[missingIndex]
            : null;

      if (targetField) {
        profile = { ...profile, [targetField]: userMessage };
      }
    }

    const nextMissingIndex = nextMissingProfileIndex(profile);
    if (nextMissingIndex >= 0) {
      const nextField = profileFieldOrder[nextMissingIndex];
      return fallbackBase(input, {
        reply: fallbackFieldPrompts[input.language][nextField],
        profile,
        phase: 'collect',
        questionIndex: nextMissingIndex,
      });
    }

    results = searchAssistanceForms(profile, input.language);
    selectedFormId = results[0]?.form.id ?? null;
    return fallbackBase(input, {
      reply: results.length > 0 ? foundFormsText(input.language, results.length) : noFormsText(input.language),
      profile,
      phase: 'forms',
      questionIndex: profileFieldOrder.length,
      results,
      selectedFormId,
      widget: results.length > 0 ? 'forms' : undefined,
    });
  }

  if (input.phase === 'forms' || input.phase === 'explain') {
    if (results.length === 0) {
      results = searchAssistanceForms(profile, input.language);
    }

    const selected = selectResultFromMessage(userMessage, results) ?? selectedResultFromState(results, selectedFormId);
    if (!selected) {
      return fallbackBase(input, {
        reply: noFormsText(input.language),
        profile,
        phase: 'forms',
        results,
      });
    }

    selectedFormId = selected.form.id;
    currentApplicationFieldId = 'documentsReady';
    return fallbackBase(input, {
      reply: `${selected.form.title}\n\n${idCaptureIntroText(input.language)}`,
      profile,
      phase: 'apply',
      results,
      selectedFormId,
      currentApplicationFieldId,
    });
  }

  if (input.phase === 'apply') {
    const selected = selectedResultFromState(results, selectedFormId);
    if (!selected) {
      results = searchAssistanceForms(profile, input.language);
      selectedFormId = results[0]?.form.id ?? null;
      return fallbackBase(input, {
        reply: results.length > 0 ? foundFormsText(input.language, results.length) : noFormsText(input.language),
        profile,
        phase: 'forms',
        results,
        selectedFormId,
        widget: results.length > 0 ? 'forms' : undefined,
      });
    }

    if (!extraAnswers.documentsReady && /id|document|captured|ready|pdf|身份证|文件/.test(userMessage.toLowerCase())) {
      extraAnswers = { ...extraAnswers, documentsReady: userMessage };
    }

    if (extraAnswers.documentsReady || currentApplicationFieldId === 'documentsReady') {
      const application = buildApplicationPackage({
        formId: selected.form.id,
        profile,
        extraAnswers,
        consents,
        language: input.language,
      });
      return fallbackBase(input, {
        reply: reviewReadyText(input.language),
        profile,
        phase: 'review',
        results,
        selectedFormId: selected.form.id,
        extraAnswers,
        currentApplicationFieldId: null,
        application,
        consents,
        widget: 'review',
      });
    }

    return fallbackBase(input, {
      reply: idCaptureIntroText(input.language),
      profile,
      phase: 'apply',
      results,
      selectedFormId: selected.form.id,
      currentApplicationFieldId: 'documentsReady',
    });
  }

  if (input.phase === 'review' || input.phase === 'consent' || input.phase === 'complete') {
    const selected = selectedResultFromState(results, selectedFormId);
    const application = selected
      ? buildApplicationPackage({
          formId: selected.form.id,
          profile,
          extraAnswers,
          consents,
          language: input.language,
        })
      : null;

    return fallbackBase(input, {
      reply: input.phase === 'consent' ? reviewReadyText(input.language) : reviewReadyText(input.language),
      profile,
      phase: input.phase,
      results,
      selectedFormId: selected?.form.id ?? selectedFormId,
      application,
      consents,
      widget: input.phase === 'consent' ? 'consent' : 'review',
    });
  }

  return fallbackBase(input, {
    reply: fallbackFieldPrompts[input.language].phone,
    profile,
    phase: 'collect',
    questionIndex: 0,
  });
}

export async function processElderlyChat(input: ElderlyChatInput): Promise<ElderlyChatOutput> {
  if (!isGeminiConfigured()) {
    return processElderlyChatFallback(input);
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

  let aiRaw: Record<string, unknown>;
  try {
    aiRaw = await geminiAIService.callGeminiElderly(
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
  } catch (error) {
    console.warn('Gemini elderly chat unavailable; using local fallback algorithm.', error);
    return processElderlyChatFallback(input);
  }

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
