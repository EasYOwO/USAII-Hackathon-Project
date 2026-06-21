'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Languages } from 'lucide-react';
import { IdDocumentCapture } from '@/components/IdDocumentCapture';
import { useLanguage, type AppLanguage } from '@/components/LanguageProvider';
import { VoiceComposer } from '@/components/VoiceComposer';
import type { ApplicantProfile, ApplicationSection, EligibilityStatus } from '@/backend/elderly/forms';
import {
  apiLanguage,
  CONSENT_ITEMS,
  copy,
  t,
  voiceCode,
  type Phase,
} from '@/elderly-assistant/flow-text';

type QuickOption = { label: string; storedValue?: string };
type MessageWidget = 'idCapture' | 'forms' | 'review' | 'consent' | 'completion';
type Message = {
  role: 'assistant' | 'user';
  content: string;
  quickOptions?: QuickOption[];
  widget?: MessageWidget;
};

type LocalizedForm = {
  id: string;
  title: string;
  agency: string;
  category: string;
  description: string;
  keyConditions: string[];
  simpleExplanation: string;
  legalNotes: string[];
  requiredFields: Array<{
    id: string;
    label: string;
    question: string;
    section: ApplicationSection;
    profileKey?: keyof ApplicantProfile;
    required: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  consentItems: string[];
  progressGuide: string[];
};

type SearchResult = {
  form: LocalizedForm;
  status: EligibilityStatus;
  score: number;
  matchedReasons?: string[];
  missingInfo?: string[];
  blockingReasons?: string[];
};

type ApplicationPackage = {
  referenceId: string;
  form: LocalizedForm;
  applicantName: string;
  phone: string;
  fields: Array<{ id: string; label: string; section: ApplicationSection; value: string; required: boolean }>;
  missingFields: string[];
  consents: Array<{ label: string; accepted: boolean }>;
  volunteer: { name: string; confidentiality: string };
  smsPreview: string;
};

type Answers = Record<string, string>;

type AiChatResponse = {
  aiEnabled: boolean;
  reply?: string;
  profile?: ApplicantProfile;
  phase?: Phase;
  questionIndex?: number;
  quickOptions?: QuickOption[];
  widget?: 'forms' | 'review' | 'consent' | 'completion';
  results?: SearchResult[];
  selectedFormId?: string | null;
  extraAnswers?: Answers;
  currentApplicationFieldId?: string | null;
  application?: ApplicationPackage | null;
  consents?: boolean[];
  shouldSpeak?: boolean;
  error?: string;
};

function speak(content: string, language: AppLanguage) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = voiceCode(language);
  window.speechSynthesis.speak(utterance);
}

function toProfile(answers: Answers): ApplicantProfile {
  return {
    name: answers.englishName,
    phone: answers.phone,
    icNumber: answers.icNumber,
    age: answers.age,
    state: answers.state,
    postcode: answers.postcode,
    taman: answers.taman,
    addressLine: answers.addressLine,
    maritalStatus: answers.maritalStatus,
    children: answers.children,
    householdIncome: answers.householdIncome,
    disability: answers.disability,
    housingStatus: answers.housingStatus,
    medicalNeed: answers.medicalNeed,
    rentalArrears: answers.rentalArrears,
  };
}

function fromProfile(profile: ApplicantProfile, previous: Answers = {}): Answers {
  return {
    ...previous,
    englishName: profile.name ?? previous.englishName,
    phone: profile.phone ?? previous.phone,
    icNumber: profile.icNumber ?? previous.icNumber,
    age: profile.age ?? previous.age,
    state: profile.state ?? previous.state,
    postcode: profile.postcode ?? previous.postcode,
    taman: profile.taman ?? previous.taman,
    addressLine: profile.addressLine ?? previous.addressLine,
    maritalStatus: profile.maritalStatus ?? previous.maritalStatus,
    children: profile.children ?? previous.children,
    householdIncome: profile.householdIncome ?? previous.householdIncome,
    disability: profile.disability ?? previous.disability,
    housingStatus: profile.housingStatus ?? previous.housingStatus,
    medicalNeed: profile.medicalNeed ?? previous.medicalNeed,
    rentalArrears: profile.rentalArrears ?? previous.rentalArrears,
  };
}

function phaseForAi(phase: Phase) {
  if (
    [
      'greeting',
      'phone',
      'name',
      'nameConfirm',
      'nameCorrection',
      'profileCollect',
      'addressConfirm',
      'situation',
    ].includes(phase)
  ) {
    return 'collect';
  }
  if (phase === 'reviewCorrection') return 'review';
  if (phase === 'idCapture') return 'apply';
  return phase;
}

function widgetFromAi(widget: unknown): MessageWidget | undefined {
  if (widget === 'forms' || widget === 'review' || widget === 'consent' || widget === 'completion') {
    return widget;
  }
  return undefined;
}

function AssistantMascot() {
  return (
    <div className="assistant-mascot" aria-hidden="true">
      <span className="mascot-hair" />
      <span className="mascot-eye left" />
      <span className="mascot-eye right" />
      <span className="mascot-cheek left" />
      <span className="mascot-cheek right" />
      <span className="mascot-smile" />
    </div>
  );
}

function statusLabel(status: EligibilityStatus, language: AppLanguage) {
  if (status === 'likely') {
    return language === 'zh' ? '资格较符合' : language === 'ms' ? 'Kelayakan mungkin sesuai' : 'Likely eligible';
  }
  if (status === 'needs-info') {
    return language === 'zh' ? '需要再确认资料' : language === 'ms' ? 'Perlu maklumat lanjut' : 'Needs more info';
  }
  return language === 'zh' ? '可能不符合' : language === 'ms' ? 'Mungkin tidak sesuai' : 'May not fit';
}

function aiMethodText(language: AppLanguage) {
  if (language === 'zh') {
    return 'AI-assisted screening: Google Gemini 3 Flash Preview helps interpret user details and extract form highlights; eligibility is also checked with local rules.';
  }
  if (language === 'ms') {
    return 'Saringan bantuan AI: Google Gemini 3 Flash Preview memahami maklumat pengguna dan meringkaskan borang; syarat kelayakan disemak semula dengan peraturan tempatan.';
  }
  return 'AI-assisted screening: Google Gemini 3 Flash Preview helps interpret user details and extract form highlights; eligibility is also checked with local rules.';
}

function consentSimpleText(language: AppLanguage) {
  if (language === 'zh') {
    return '简单版：请确认资料真实准确；同意相关单位核对资格和证明；正式提交前会有人再检查。';
  }
  if (language === 'ms') {
    return 'Versi ringkas: Sahkan maklumat adalah benar; benarkan semakan kelayakan dan dokumen; maklumat akan disemak sebelum penghantaran rasmi.';
  }
  return 'Simple version: confirm the information is truthful; allow eligibility and document checks; details will be reviewed before official submission.';
}

function modelLoadingText(language: AppLanguage) {
  if (language === 'zh') {
    return {
      title: 'AI 模型加载中',
      detail: '正在准备 Gemini 3 Flash Preview',
    };
  }
  if (language === 'ms') {
    return {
      title: 'Model AI sedang dimuatkan',
      detail: 'Menyediakan Gemini 3 Flash Preview',
    };
  }
  return {
    title: 'Loading AI model',
    detail: 'Preparing Gemini 3 Flash Preview',
  };
}

export function ElderlyAssistantClient() {
  const { language, hasChosenLanguage } = useLanguage();
  const initializedLang = useRef<AppLanguage | null>(null);
  const [phase, setPhase] = useState<Phase>('greeting');
  const [messages, setMessages] = useState<Message[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [profileIndex, setProfileIndex] = useState(0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [extraAnswers, setExtraAnswers] = useState<Answers>({});
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  const [application, setApplication] = useState<ApplicationPackage | null>(null);
  const [consents, setConsents] = useState<boolean[]>([]);
  const [idDocumentReady, setIdDocumentReady] = useState(false);
  const [idFileName, setIdFileName] = useState('');
  const [correctionFieldId, setCorrectionFieldId] = useState<string | null>(null);
  const [aiStarted, setAiStarted] = useState(false);
  const [showLoadingBubble, setShowLoadingBubble] = useState(false);

  const expectsAnswer = !['searching', 'idCapture', 'complete'].includes(phase) && !loading;
  const username = answers.englishName || 'user';

  function addAssistant(content: string, options?: { quickOptions?: QuickOption[]; widget?: MessageWidget; speak?: boolean }) {
    setMessages((current) => [...current, { role: 'assistant', content, quickOptions: options?.quickOptions, widget: options?.widget }]);
    if (options?.speak) speak(content, language);
  }

  function addUser(content: string) {
    setMessages((current) => [...current, { role: 'user', content }]);
  }

  function applyAiResponse(
    data: AiChatResponse,
    base: {
      answersState?: Answers;
      resultsState?: SearchResult[];
      selectedResultState?: SearchResult | null;
      extraAnswersState?: Answers;
      currentFieldIdState?: string | null;
      applicationState?: ApplicationPackage | null;
      consentsState?: boolean[];
      questionIndexState?: number;
      phaseState?: Phase;
    } = {},
  ) {
    const baseAnswers = base.answersState ?? answers;
    const baseResults = base.resultsState ?? results;
    const baseSelectedResult = base.selectedResultState ?? selectedResult;
    const baseExtraAnswers = base.extraAnswersState ?? extraAnswers;
    const baseCurrentFieldId = base.currentFieldIdState ?? currentFieldId;
    const baseApplication = base.applicationState ?? application;
    const baseConsents = base.consentsState ?? consents;
    const baseQuestionIndex = base.questionIndexState ?? profileIndex;
    const basePhase = base.phaseState ?? phase;
    const nextProfile = data.profile ?? toProfile(baseAnswers);
    const nextAnswers = fromProfile(nextProfile, baseAnswers);
    const nextResults = data.results ?? baseResults;
    const selectedFormId = data.selectedFormId ?? baseSelectedResult?.form.id ?? null;
    const nextSelectedResult = nextResults.find((result) => result.form.id === selectedFormId) ?? nextResults[0] ?? null;
    const nextExtraAnswers = data.extraAnswers ?? baseExtraAnswers;
    const nextCurrentFieldId = data.currentApplicationFieldId ?? baseCurrentFieldId;
    const nextConsents = data.consents ?? baseConsents;
    const nextApplication = data.application === undefined ? baseApplication : data.application;
    let nextPhase = data.phase ?? basePhase;
    let widget = widgetFromAi(data.widget);

    if (!widget && nextPhase === 'forms' && nextResults.length > 0) widget = 'forms';
    if (!widget && nextPhase === 'review' && nextApplication) widget = 'review';
    if (!widget && nextPhase === 'consent') widget = 'consent';
    if (!widget && nextPhase === 'complete') widget = 'completion';
    if (nextPhase === 'apply' && nextCurrentFieldId === 'documentsReady' && !idDocumentReady) {
      nextPhase = 'idCapture';
      widget = 'idCapture';
    }

    setAnswers(nextAnswers);
    setProfileIndex(data.questionIndex ?? baseQuestionIndex);
    setResults(nextResults);
    setSelectedResult(nextSelectedResult);
    setExtraAnswers(nextExtraAnswers);
    setCurrentFieldId(nextCurrentFieldId);
    setApplication(nextApplication ?? null);
    setConsents(nextConsents);
    setPhase(nextPhase);
    setAiStarted(true);
    if (nextPhase !== 'reviewCorrection') {
      setCorrectionFieldId(null);
    }

    addAssistant(data.reply || data.error || (language === 'zh' ? 'AI 暂时无法回应，请稍后再试。' : 'AI is temporarily unavailable.'), {
      quickOptions: data.quickOptions,
      widget,
      speak: data.shouldSpeak ?? true,
    });
  }

  async function requestAiChat(
    action: 'init' | 'message',
    userMessage = '',
    displayMessage = userMessage,
    state: {
      history?: Message[];
      answersState?: Answers;
      phaseState?: Phase;
      resultsState?: SearchResult[];
      selectedResultState?: SearchResult | null;
      extraAnswersState?: Answers;
      currentFieldIdState?: string | null;
      applicationState?: ApplicationPackage | null;
      consentsState?: boolean[];
      questionIndexState?: number;
      showUserMessage?: boolean;
      showLoadingBubble?: boolean;
    } = {},
  ) {
    const trimmedMessage = userMessage.trim();
    if (action === 'message' && !trimmedMessage) return;

    const history = state.history ?? messages;
    const requestAnswers = state.answersState ?? answers;
    const requestPhase = state.phaseState ?? phase;
    const requestResults = state.resultsState ?? results;
    const requestSelectedResult = state.selectedResultState ?? selectedResult;
    const requestExtraAnswers = state.extraAnswersState ?? extraAnswers;
    const requestCurrentFieldId = state.currentFieldIdState ?? currentFieldId;
    const requestApplication = state.applicationState ?? application;
    const requestConsents = state.consentsState ?? consents;
    const requestQuestionIndex = state.questionIndexState ?? profileIndex;

    if (action === 'message' && state.showUserMessage !== false) {
      addUser(displayMessage.trim() || trimmedMessage);
    }
    setInput('');
    setShowLoadingBubble(state.showLoadingBubble !== false);
    setLoading(true);

    try {
      const response = await fetch('/api/elderly/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userMessage: trimmedMessage,
          language: apiLanguage(language),
          phase: phaseForAi(requestPhase),
          profile: toProfile(requestAnswers),
          questionIndex: requestQuestionIndex,
          messages: history.map((message) => ({ role: message.role, content: message.content })),
          results: requestResults,
          selectedFormId: requestSelectedResult?.form.id ?? null,
          extraAnswers: requestExtraAnswers,
          currentApplicationFieldId: requestCurrentFieldId,
          consents: requestConsents,
        }),
      });
      const data = (await response.json()) as AiChatResponse;
      if (!response.ok) {
        throw new Error(data.error || `AI request failed with status ${response.status}`);
      }
      applyAiResponse(data, {
        answersState: requestAnswers,
        resultsState: requestResults,
        selectedResultState: requestSelectedResult,
        extraAnswersState: requestExtraAnswers,
        currentFieldIdState: requestCurrentFieldId,
        applicationState: requestApplication,
        consentsState: requestConsents,
        questionIndexState: requestQuestionIndex,
        phaseState: requestPhase,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI request failed';
      addAssistant(language === 'zh' ? `AI 暂时无法回应：${message}` : `AI is temporarily unavailable: ${message}`, { speak: true });
    } finally {
      setLoading(false);
      setShowLoadingBubble(false);
    }
  }

  function startFlow() {
    setPhase('collect');
    setAnswers({});
    setProfileIndex(0);
    setInput('');
    setLoading(false);
    setResults([]);
    setSelectedResult(null);
    setExtraAnswers({});
    setCurrentFieldId(null);
    setApplication(null);
    setConsents([]);
    setIdDocumentReady(false);
    setIdFileName('');
    setCorrectionFieldId(null);
    setAiStarted(false);
    sessionStorage.setItem('elderly-flow-active', '1');
    setMessages([]);
    requestInitialAi();
  }

  function requestInitialAi(userMessage = '', displayMessage = userMessage) {
    const emptyAnswers: Answers = {};
    const emptyResults: SearchResult[] = [];
    const emptyExtraAnswers: Answers = {};
    const firstMessage = userMessage.trim();
    const action: 'init' | 'message' = firstMessage ? 'message' : 'init';

    setAiStarted(true);
    setMessages([]);
    void requestAiChat(action, firstMessage, displayMessage, {
      history: [],
      answersState: emptyAnswers,
      phaseState: 'collect',
      resultsState: emptyResults,
      selectedResultState: null,
      extraAnswersState: emptyExtraAnswers,
      currentFieldIdState: null,
      applicationState: null,
      consentsState: [],
      showUserMessage: action === 'message',
      showLoadingBubble: action !== 'init',
    });
  }

  useEffect(() => {
    if (!hasChosenLanguage) return;
    if (initializedLang.current === language) return;
    initializedLang.current = language;
    startFlow();
  }, [hasChosenLanguage, language]);

  async function completeFlow() {
    if (!application) return;
    const allConsented = consentItems().every((_, index) => consents[index]);
    if (!allConsented) return;

    setLoading(true);
    await fetch('/api/elderly/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: answers.phone,
        language: apiLanguage(language),
        referenceId: application.referenceId,
        formTitle: application.form.title,
        smsMessage: application.smsPreview,
      }),
    }).catch(() => undefined);

    setPhase('complete');
    setLoading(false);
    if (idFileName) {
      void fetch(`/api/pdf/files/${encodeURIComponent(idFileName)}`, { method: 'DELETE' }).catch(() => undefined);
    }
    sessionStorage.removeItem('elderly-id-file');
    localStorage.removeItem('report-workflow-user');
    addAssistant(`${t(language, copy.complete)}\n\n${t(language, copy.smsSent)}`, { speak: true, widget: 'completion' });
  }

  function consentItems() {
    return selectedResult?.form.consentItems.length ? selectedResult.form.consentItems : CONSENT_ITEMS[language];
  }

  function yesNoOptions(): QuickOption[] {
    return [
      { label: t(language, copy.yes), storedValue: 'yes' },
      { label: t(language, copy.no), storedValue: 'no' },
    ];
  }

  function isYesResponse(value: string) {
    const normalized = value.trim().toLowerCase();
    return ['yes', 'y', 'correct', 'ok', 'true', 'betul', 'ya'].some((item) => normalized.includes(item));
  }

  function isNoResponse(value: string) {
    const normalized = value.trim().toLowerCase();
    return ['no', 'n', 'wrong', 'false', 'salah', 'tidak'].some((item) => normalized.includes(item));
  }

  function reviewFieldOptions(): QuickOption[] {
    return (
      application?.fields.map((field) => ({
        label: field.label,
        storedValue: field.id,
      })) ?? []
    );
  }

  function findReviewField(value: string) {
    const normalized = value.trim().toLowerCase();
    return application?.fields.find((field) => field.id === value || field.label.toLowerCase() === normalized) ?? null;
  }

  function getAnswerKey(profileKey?: keyof ApplicantProfile) {
    if (!profileKey) return null;
    return profileKey === 'name' ? 'englishName' : profileKey;
  }

  async function rebuildReview(nextAnswers: Answers, nextExtraAnswers: Answers, updatedLabel: string) {
    if (!selectedResult) return;

    setLoading(true);
    try {
      const response = await fetch('/api/elderly/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: selectedResult.form.id,
          profile: toProfile(nextAnswers),
          extraAnswers: nextExtraAnswers,
          consents,
          language: apiLanguage(language),
        }),
      });
      const data = (await response.json()) as { application: ApplicationPackage };
      setAnswers(nextAnswers);
      setExtraAnswers(nextExtraAnswers);
      setApplication(data.application);
      setCorrectionFieldId(null);
      setPhase('review');
      addAssistant(`I updated ${updatedLabel}. Please check the draft again.`, {
        quickOptions: yesNoOptions(),
        widget: 'review',
        speak: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'review rebuild failed';
      addAssistant(`I could not update the draft yet. ${message}`, { speak: true });
    } finally {
      setLoading(false);
    }
  }

  async function applyReviewCorrection(fieldId: string, value: string) {
    const reviewField = application?.fields.find((field) => field.id === fieldId);
    const formField = selectedResult?.form.requiredFields.find((field) => field.id === fieldId);
    if (!reviewField) return;

    const nextAnswers = { ...answers };
    const nextExtraAnswers = { ...extraAnswers };
    const answerKey = getAnswerKey(formField?.profileKey);

    if (answerKey) {
      nextAnswers[answerKey] = value;
    } else {
      nextExtraAnswers[fieldId] = value;
    }

    await rebuildReview(nextAnswers, nextExtraAnswers, reviewField.label);
  }

  async function handleReviewAnswer(displayValue: string, storedValue: string) {
    const value = storedValue.trim();
    addUser(displayValue.trim());
    setInput('');

    if (phase === 'review') {
      if (isYesResponse(value)) {
        const items = consentItems();
        setConsents(items.map(() => false));
        setCorrectionFieldId(null);
        setPhase('consent');
        addAssistant(t(language, copy.consentAsk), { widget: 'consent', speak: true });
        return;
      }

      if (isNoResponse(value)) {
        setCorrectionFieldId(null);
        setPhase('reviewCorrection');
        addAssistant(t(language, copy.correctionAsk), {
          quickOptions: reviewFieldOptions(),
          widget: 'review',
          speak: true,
        });
        return;
      }

      addAssistant('Please choose Correct / Yes or Wrong / No.', {
        quickOptions: yesNoOptions(),
        widget: 'review',
        speak: true,
      });
      return;
    }

    if (!correctionFieldId) {
      const field = findReviewField(value);
      if (!field) {
        addAssistant('Which detail should I change?', {
          quickOptions: reviewFieldOptions(),
          widget: 'review',
          speak: true,
        });
        return;
      }

      setCorrectionFieldId(field.id);
      addAssistant(`Please type the correct value for ${field.label}.`, { speak: true });
      return;
    }

    await applyReviewCorrection(correctionFieldId, value);
  }

  function submitAnswer(displayValue: string, storedValue = displayValue) {
    const value = storedValue.trim();
    if (!value || loading) return;

    if (!aiStarted) {
      requestInitialAi(value, displayValue);
      return;
    }

    if (phase === 'idCapture' && !idDocumentReady) return;

    if (phase === 'review' || phase === 'reviewCorrection') {
      void handleReviewAnswer(displayValue, value);
      return;
    }

    void requestAiChat('message', value, displayValue);
  }

  function onIdComplete(fileName: string) {
    const nextExtra = { ...extraAnswers, documentsReady: `ID document: ${fileName}` };
    setIdDocumentReady(true);
    setIdFileName(fileName);
    setExtraAnswers(nextExtra);
    sessionStorage.setItem('elderly-id-file', fileName);
    addAssistant(
      language === 'zh'
        ? `身份证照片已自动转换成 PDF：${fileName}。`
        : language === 'ms'
          ? `Gambar ID telah ditukar secara automatik kepada PDF: ${fileName}.`
          : `The ID photos were automatically converted into a PDF: ${fileName}.`,
      { speak: true },
    );
    void requestAiChat(
      'message',
      `ID document captured and saved as ${fileName}. Please continue the application.`,
      'ID document is ready',
      {
        extraAnswersState: nextExtra,
        currentFieldIdState: 'documentsReady',
        phaseState: 'apply',
      },
    );
  }

  function renderForms() {
    return (
      <div className="assistant-card-list">
        <div className="screen-note">
          <strong>{language === 'zh' ? '筛选机制' : language === 'ms' ? 'Mekanisme saringan' : 'Screening method'}</strong>
          <span>{aiMethodText(language)}</span>
        </div>
        {results.map((result, index) => (
          <button
            className="aid-card"
            key={result.form.id}
            type="button"
            onClick={() => submitAnswer(`${index + 1}. ${result.form.title}`, String(index + 1))}
          >
            <strong>
              {index + 1}. {result.form.title}
            </strong>
            <small>{result.form.agency}</small>
            <span className={`status eligibility-${result.status}`}>{statusLabel(result.status, language)}</span>
            <ul className="condition-list">
              {result.form.keyConditions.slice(0, 3).map((condition) => (
                <li key={condition}>{condition}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    );
  }

  function renderReview() {
    if (!application) return null;
    return (
      <div className="review-stack">
        <div className="reference-box">
          <span>{language === 'zh' ? '申请编号' : 'Reference'}</span>
          <strong>{application.referenceId}</strong>
        </div>
        {application.fields.map((field) =>
          phase === 'reviewCorrection' && !correctionFieldId ? (
            <button className="review-row review-row-button" key={field.id} type="button" onClick={() => submitAnswer(field.label, field.id)}>
              <span>{field.label}</span>
              <strong>{field.value || '-'}</strong>
            </button>
          ) : (
            <div className="review-row" key={field.id}>
              <span>{field.label}</span>
              <strong>{field.value || '-'}</strong>
            </div>
          ),
        )}
        {application.missingFields.length > 0 ? <div className="notice">{application.missingFields.join(', ')}</div> : null}
      </div>
    );
  }

  function renderConsent() {
    const items = consentItems();
    return (
      <div className="consent-list">
        <div className="terms-simple-box">
          <strong>{language === 'zh' ? '简单版' : language === 'ms' ? 'Versi ringkas' : 'Simple version'}</strong>
          <p>{consentSimpleText(language)}</p>
        </div>
        <div className="terms-detail-title">
          {language === 'zh' ? '重点完整条款' : language === 'ms' ? 'Syarat penting penuh' : 'Important full terms'}
        </div>
        {items.map((item, index) => (
          <label className="consent-item" key={item}>
            <input
              type="checkbox"
              checked={Boolean(consents[index])}
              onChange={() =>
                setConsents((current) => {
                  const next = [...current];
                  next[index] = !next[index];
                  return next;
                })
              }
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
    );
  }

  function renderCompletion() {
    if (!application) return null;
    return (
      <div className="completion-panel">
        <div className="result-success">
          <CheckCircle2 size={20} />
          {application.form.title}
        </div>
        <div className="reference-box">
          <span>{language === 'zh' ? '志愿者保密说明' : 'Volunteer confidentiality'}</span>
          <strong>{application.volunteer.name}</strong>
          <p>{application.volunteer.confidentiality}</p>
        </div>
        <div className="reference-box">
          <span>{language === 'zh' ? '短信内容' : 'SMS message'}</span>
          <p>{application.smsPreview}</p>
        </div>
      </div>
    );
  }

  const screenMessages = useMemo(() => {
    const indexedMessages = messages.map((message, index) => ({ message, index }));
    if (indexedMessages.length === 0) return indexedMessages;

    const latestAssistant = [...indexedMessages].reverse().find(({ message }) => message.role === 'assistant');
    return latestAssistant ? [latestAssistant] : [indexedMessages[indexedMessages.length - 1]];
  }, [messages]);

  const hasAssistantOnScreen = screenMessages.some(({ message }) => message.role === 'assistant');
  const allConsentsAccepted = consentItems().every((_, index) => consents[index]);
  const initialModelLoading = loading && !showLoadingBubble && messages.length === 0;
  const modelLoadCopy = modelLoadingText(language);

  return (
    <div className="elderly-workspace ui-sample-layout">
      <section className="wa-chat elder-chat chatbot-full">
        <div className="wa-chat-header">
          <div className="wa-avatar">
            <Languages size={20} />
          </div>
          <div>
            <strong>{language === 'zh' ? '政府援助申请助手' : 'Assistance Application Assistant'}</strong>
            <span>{language === 'zh' ? '语音 + 文字' : 'Voice + text'}</span>
          </div>
        </div>
        <div className="wa-stream">
          <div className="assistant-screen">
            {initialModelLoading ? (
              <div className="model-load-panel" role="status" aria-live="polite">
                <div className="model-load-copy">
                  <strong>{modelLoadCopy.title}</strong>
                  <span>{modelLoadCopy.detail}</span>
                </div>
                <div className="model-load-bar" aria-hidden="true">
                  <span />
                </div>
              </div>
            ) : null}
            {hasAssistantOnScreen ? <AssistantMascot /> : null}
            {screenMessages.map(({ message, index }) => (
              <div className={`assistant-message-block ${message.role === 'user' ? 'from-user' : 'from-assistant'}`} key={`${message.role}-${index}`}>
                <div className={`wa-bubble ${message.role === 'user' ? 'user' : ''}`}>{message.content}</div>
                {message.quickOptions && message.widget !== 'forms' ? (
                  <div className="quick-options">
                    {message.quickOptions.map((option) => (
                      <button
                        className={`chip-button ${option.storedValue === 'yes' ? 'success' : option.storedValue === 'no' ? 'danger' : ''}`}
                        key={`${option.label}-${option.storedValue ?? option.label}`}
                        type="button"
                        onClick={() => submitAnswer(option.label, option.storedValue ?? option.label)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              {message.widget === 'idCapture' && phase === 'idCapture' ? (
                <IdDocumentCapture
                  username={username}
                  language={language}
                  onComplete={onIdComplete}
                  labels={{
                    title: language === 'zh' ? '拍摄身份证' : 'Capture ID',
                    front: language === 'zh' ? '正面' : 'Front',
                    back: language === 'zh' ? '背面' : 'Back',
                    capture: language === 'zh' ? '拍照' : 'Capture',
                    retake: language === 'zh' ? '重拍' : 'Retake',
                    submit: language === 'zh' ? '生成文件' : 'Create document',
                    ready: language === 'zh' ? '文件已准备好' : 'Document ready',
                    needBoth: language === 'zh' ? '请先拍摄正面和背面。' : 'Please capture both sides first.',
                    working: language === 'zh' ? '准备相机...' : 'Preparing camera...',
                  }}
                />
              ) : null}
              {message.widget === 'forms' ? renderForms() : null}
              {message.widget === 'review' ? renderReview() : null}
              {message.widget === 'consent' ? renderConsent() : null}
              {message.widget === 'completion' ? renderCompletion() : null}
            </div>
          ))}
          {loading && showLoadingBubble ? <div className="wa-bubble">{language === 'zh' ? '处理中...' : 'Working...'}</div> : null}
          </div>
        </div>
        <VoiceComposer
          value={input}
          onChange={setInput}
          onSubmit={() => submitAnswer(input)}
          placeholder={language === 'zh' ? '输入或说话' : 'Type or speak'}
          disabled={!expectsAnswer || phase === 'consent'}
          visible={expectsAnswer && phase !== 'idCapture' && phase !== 'consent'}
          languageCode={voiceCode(language)}
          listeningLabel={t(language, copy.micOn)}
          idleLabel={t(language, copy.micOff)}
          tapHint={expectsAnswer ? t(language, copy.tapMic) : undefined}
          unsupportedHint={language === 'zh' ? '此浏览器不支持语音输入，请改用打字。' : 'Voice input is not supported in this browser. Please type instead.'}
          variant="center"
        />
        {phase === 'consent' ? (
          <div className="button-row consent-submit-row">
            <button className="btn primary" type="button" disabled={!allConsentsAccepted || loading} onClick={() => void completeFlow()}>
              {language === 'zh' ? '同意并完成' : 'Agree and complete'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
