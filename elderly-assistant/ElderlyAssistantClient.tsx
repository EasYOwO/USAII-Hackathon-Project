'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Languages } from 'lucide-react';
import { IdDocumentCapture } from '@/components/IdDocumentCapture';
import { useLanguage, type AppLanguage } from '@/components/LanguageProvider';
import { VoiceComposer } from '@/components/VoiceComposer';
import type { ApplicantProfile, ApplicationSection, EligibilityStatus } from '@/backend/elderly/forms';
import {
  addressFields,
  apiLanguage,
  CONSENT_ITEMS,
  copy,
  fieldLabels,
  fieldOptions,
  fieldPrompts,
  fill,
  profileFieldOrder,
  t,
  voiceCode,
  type Phase,
  type ProfileField,
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

function speak(content: string, language: AppLanguage) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = voiceCode(language);
  window.speechSynthesis.speak(utterance);
}

function isYes(value: string) {
  const n = value.trim().toLowerCase();
  return ['yes', 'y', 'correct', 'ok', 'true', '是', '对', '對', '正确', '正確', 'betul', 'ya'].some((x) => n.includes(x));
}

function isNo(value: string) {
  const n = value.trim().toLowerCase();
  return ['no', 'n', 'wrong', 'false', '不是', '不对', '不對', '错误', '錯誤', 'salah', 'tidak'].some((x) => n.includes(x));
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
    return 'AI 辅助筛选：Google Gemini 2.0 Flash 负责理解用户资料与提炼表格重点；资格条件再用本地规则检查，避免只靠 AI 判断。';
  }
  if (language === 'ms') {
    return 'Saringan bantuan AI: Google Gemini 2.0 Flash memahami maklumat pengguna dan meringkaskan borang; syarat kelayakan disemak semula dengan peraturan tempatan.';
  }
  return 'AI-assisted screening: Google Gemini 2.0 Flash helps interpret user details and extract form highlights; eligibility is also checked with local rules.';
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

  const expectsAnswer = !['searching', 'idCapture', 'complete'].includes(phase) && !loading;
  const username = answers.englishName || 'user';

  function addAssistant(content: string, options?: { quickOptions?: QuickOption[]; widget?: MessageWidget; speak?: boolean }) {
    setMessages((current) => [...current, { role: 'assistant', content, quickOptions: options?.quickOptions, widget: options?.widget }]);
    if (options?.speak) speak(content, language);
  }

  function addUser(content: string) {
    setMessages((current) => [...current, { role: 'user', content }]);
  }

  function yesNoOptions(): QuickOption[] {
    return [
      { label: t(language, copy.yes), storedValue: 'yes' },
      { label: t(language, copy.no), storedValue: 'no' },
    ];
  }

  function optionsForField(field: ProfileField): QuickOption[] | undefined {
    return fieldOptions[field]?.map((option) => ({
      label: t(language, option.label),
      storedValue: option.storedValue,
    }));
  }

  function askProfile(index: number) {
    const field = profileFieldOrder[index];
    addAssistant(t(language, fieldPrompts[field]), {
      speak: true,
      quickOptions: optionsForField(field),
    });
  }

  function formatAddress(nextAnswers = answers) {
    return [nextAnswers.addressLine, nextAnswers.taman, nextAnswers.postcode, nextAnswers.state].filter(Boolean).join(', ');
  }

  function startFlow() {
    const firstPrompt = `${t(language, copy.welcome)}\n\n${t(language, copy.welcomeSecond)}\n\n${t(language, copy.askPhone)}`;
    const initialMessages: Message[] = [{ role: 'assistant', content: firstPrompt }];

    setPhase('phone');
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
    sessionStorage.setItem('elderly-flow-active', '1');
    setMessages(initialMessages);
    speak(firstPrompt, language);
  }

  useEffect(() => {
    if (!hasChosenLanguage) return;
    if (initializedLang.current === language) return;
    initializedLang.current = language;
    startFlow();
  }, [hasChosenLanguage, language]);

  function getKnownFieldValue(
    field: LocalizedForm['requiredFields'][number],
    extra = extraAnswers,
    idReady = idDocumentReady,
    fileName = idFileName,
  ) {
    if (extra[field.id]?.trim()) return extra[field.id].trim();
    if (field.id === 'documentsReady' && idReady) return `ID document: ${fileName || 'ready'}`;
    if (field.profileKey === 'name') return answers.englishName?.trim() ?? '';
    if (field.profileKey) return answers[field.profileKey]?.trim() ?? '';
    return answers[field.id]?.trim() ?? '';
  }

  function nextApplicationField(extra = extraAnswers, idReady = idDocumentReady, fileName = idFileName) {
    return selectedResult?.form.requiredFields.find((field) => field.required && !getKnownFieldValue(field, extra, idReady, fileName)) ?? null;
  }

  function askApplicationField(field: LocalizedForm['requiredFields'][number]) {
    setPhase('apply');
    setCurrentFieldId(field.id);
    addAssistant(field.question, {
      speak: true,
      quickOptions: field.options?.map((option) => ({ label: option.label, storedValue: option.label })),
    });
  }

  function continueApplication(extra = extraAnswers, idReady = idDocumentReady, fileName = idFileName) {
    if (!idReady) {
      setPhase('idCapture');
      addAssistant(t(language, copy.idCaptureIntro), { speak: true, widget: 'idCapture' });
      return;
    }

    const field = nextApplicationField(extra, idReady, fileName);
    if (field) {
      askApplicationField(field);
      return;
    }

    void buildReview(extra, idReady, fileName);
  }

  async function searchForms(nextAnswers: Answers) {
    setLoading(true);
    setPhase('searching');
    addAssistant(t(language, copy.searching), { speak: true });

    const response = await fetch('/api/elderly/forms/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: toProfile(nextAnswers), language: apiLanguage(language) }),
    });
    const data = (await response.json()) as { results: SearchResult[] };
    const topResults = data.results.slice(0, 3);

    setResults(topResults);
    setSelectedResult(topResults[0] ?? null);
    setPhase('forms');
    setLoading(false);
    addAssistant(
      topResults.length > 0 ? fill(t(language, copy.foundForms), { count: topResults.length }) : t(language, copy.noForms),
      {
        speak: true,
        widget: topResults.length > 0 ? 'forms' : undefined,
        quickOptions: topResults.map((result, index) => ({ label: `${index + 1}. ${result.form.title}`, storedValue: String(index + 1) })),
      },
    );
  }

  async function buildReview(extra = extraAnswers, idReady = idDocumentReady, fileName = idFileName) {
    if (!selectedResult) return;
    setLoading(true);

    const reviewExtraAnswers = {
      ...extra,
      documentsReady: idReady ? `ID document: ${fileName || 'ready'}` : '',
      situation: answers.situation ?? '',
    };
    const response = await fetch('/api/elderly/application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formId: selectedResult.form.id,
        profile: toProfile(answers),
        extraAnswers: reviewExtraAnswers,
        consents,
        language: apiLanguage(language),
      }),
    });
    const data = (await response.json()) as { application: ApplicationPackage };

    setApplication(data.application);
    setPhase('review');
    setLoading(false);
    addAssistant(t(language, copy.reviewReady), { widget: 'review', quickOptions: yesNoOptions(), speak: true });
  }

  function buildExplanation(result: SearchResult) {
    const conditions = result.form.keyConditions.map((condition, index) => `${index + 1}. ${condition}`).join('\n');
    const legalNotes = result.form.legalNotes.map((note, index) => `${index + 1}. ${note}`).join('\n');
    const matchedReasons = result.matchedReasons?.length
      ? result.matchedReasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')
      : language === 'zh'
        ? '1. 系统会根据您刚才提供的基本资料继续核对。'
        : '1. The system will continue checking against the basic details you provided.';
    const heading =
      language === 'zh'
        ? `${result.form.title}\n\nAI 提炼摘要（Google Gemini 2.0 Flash）：${result.form.simpleExplanation}\n\n资格判断：${statusLabel(result.status, language)}\n\n为什么推荐：\n${matchedReasons}\n\n申请资格重点：\n${conditions}\n\n重要说明：\n${legalNotes}`
        : `${result.form.title}\n\nAI-extracted summary (Google Gemini 2.0 Flash): ${result.form.simpleExplanation}\n\nEligibility check: ${statusLabel(result.status, language)}\n\nWhy this was recommended:\n${matchedReasons}\n\nKey eligibility points:\n${conditions}\n\nImportant notes:\n${legalNotes}`;
    return heading;
  }

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

  function submitAnswer(displayValue: string, storedValue = displayValue) {
    const value = storedValue.trim();
    if (!value || loading) return;
    if (phase === 'idCapture' && !idDocumentReady) return;

    addUser(displayValue.trim());
    setInput('');

    if (phase === 'phone') {
      setAnswers((current) => ({ ...current, phone: value }));
      setPhase('name');
      addAssistant(t(language, copy.askName), { speak: true });
      return;
    }

    if (phase === 'name') {
      setAnswers((current) => ({ ...current, englishName: value }));
      setPhase('nameConfirm');
      addAssistant(fill(t(language, copy.nameConfirm), { value }), { speak: true, quickOptions: yesNoOptions() });
      return;
    }

    if (phase === 'nameConfirm') {
      if (isYes(value)) {
        setPhase('profileCollect');
        setProfileIndex(0);
        askProfile(0);
        return;
      }
      if (isNo(value)) {
        setPhase('nameCorrection');
        addAssistant(t(language, copy.spellName), { speak: true });
        return;
      }
      addAssistant(language === 'zh' ? '请说正确或错误。' : 'Please say correct or wrong.', { quickOptions: yesNoOptions() });
      return;
    }

    if (phase === 'nameCorrection') {
      setAnswers((current) => ({ ...current, englishName: value }));
      setPhase('nameConfirm');
      addAssistant(fill(t(language, copy.nameConfirm), { value }), { speak: true, quickOptions: yesNoOptions() });
      return;
    }

    if (phase === 'profileCollect') {
      const field = profileFieldOrder[profileIndex];
      const next = { ...answers, [field]: value };
      setAnswers(next);
      const nextIndex = profileIndex + 1;

      if (field === 'addressLine') {
        setPhase('addressConfirm');
        addAssistant(fill(t(language, copy.addressConfirm), { value: formatAddress(next) }), { speak: true, quickOptions: yesNoOptions() });
        return;
      }

      if (nextIndex < profileFieldOrder.length) {
        setProfileIndex(nextIndex);
        askProfile(nextIndex);
        return;
      }

      void searchForms(next);
      return;
    }

    if (phase === 'addressConfirm') {
      if (isYes(value)) {
        const nextIndex = profileFieldOrder.findIndex((field) => field === 'maritalStatus');
        setPhase('profileCollect');
        setProfileIndex(nextIndex);
        askProfile(nextIndex);
        return;
      }
      if (isNo(value)) {
        const nextIndex = profileFieldOrder.findIndex((field) => field === addressFields[0]);
        setPhase('profileCollect');
        setProfileIndex(nextIndex);
        addAssistant(t(language, copy.addressRetry), { speak: true });
        askProfile(nextIndex);
        return;
      }
      addAssistant(language === 'zh' ? '请说正确或错误。' : 'Please say correct or wrong.', { quickOptions: yesNoOptions() });
      return;
    }

    if (phase === 'situation') {
      const next = { ...answers, situation: value };
      setAnswers(next);
      void searchForms(next);
      return;
    }

    if (phase === 'forms') {
      const index = Number(value) - 1;
      const result = results[index] ?? results.find((item) => item.form.title.toLowerCase().includes(value.toLowerCase()));
      if (!result) return;
      setSelectedResult(result);
      setPhase('explain');
      addAssistant(`${buildExplanation(result)}\n\n${t(language, copy.continueForm)}`, {
        quickOptions: yesNoOptions(),
        speak: true,
      });
      return;
    }

    if (phase === 'explain') {
      if (isNo(value)) {
        setPhase('forms');
        addAssistant(language === 'zh' ? '请选择另一份表格。' : 'Please choose another form.', {
          widget: 'forms',
          quickOptions: results.map((result, index) => ({ label: `${index + 1}. ${result.form.title}`, storedValue: String(index + 1) })),
        });
        return;
      }
      if (isYes(value)) {
        continueApplication();
      }
      return;
    }

    if (phase === 'apply') {
      const nextExtra = { ...extraAnswers, [currentFieldId ?? 'field']: value };
      setExtraAnswers(nextExtra);
      continueApplication(nextExtra);
      return;
    }

    if (phase === 'review') {
      if (isYes(value)) {
        const items = consentItems();
        setConsents(items.map(() => false));
        setPhase('consent');
        addAssistant(t(language, copy.consentAsk), { widget: 'consent', speak: true });
        return;
      }
      if (isNo(value)) {
        setPhase('reviewCorrection');
        addAssistant(t(language, copy.correctionAsk), { speak: true });
      }
      return;
    }

    if (phase === 'reviewCorrection') {
      const nextExtra = { ...extraAnswers, reviewCorrection: value };
      setExtraAnswers(nextExtra);
      void buildReview(nextExtra);
      return;
    }
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
    continueApplication(nextExtra, true, fileName);
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
        {application.fields.map((field) => (
          <div className="review-row" key={field.id}>
            <span>{field.label}</span>
            <strong>{field.value || '-'}</strong>
          </div>
        ))}
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
          {loading ? <div className="wa-bubble">{language === 'zh' ? '处理中...' : 'Working...'}</div> : null}
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
