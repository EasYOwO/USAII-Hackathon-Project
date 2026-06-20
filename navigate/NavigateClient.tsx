'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, CheckCircle2, FileSearch, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { VoiceComposer } from '@/components/VoiceComposer';

type ReportQuestion = {
  id: string;
  label: string;
  placeholder: string;
  options: string[];
};

type ReportResult = {
  id: string;
  title: string;
  owner: string;
  category: string;
  updatedAt: string;
  status: string;
  summary: string;
};

type Message = {
  role: 'assistant' | 'user';
  content: string;
};

type SearchPayload = {
  keywords: string[];
  results: ReportResult[];
};

type NavigateInsight = {
  spokenSummary: string;
  highlights: string[];
  recommendedReportId: string | null;
  confidence: 'High' | 'Medium' | 'Low';
};

function speak(text: string, language: 'en' | 'zh') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
  window.speechSynthesis.speak(utterance);
}

export function NavigateClient() {
  const { language, t } = useLanguage();
  const [questions, setQuestions] = useState<ReportQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const [selected, setSelected] = useState<ReportResult | null>(null);
  const [insight, setInsight] = useState<NavigateInsight | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const currentQuestion = questions[questionIndex];
  const searchDone = Boolean(payload);

  useEffect(() => {
    setQuestions([]);
    setQuestionIndex(0);
    setAnswers({});
    setPayload(null);
    setSelected(null);
    setInsight(null);
    setMessage('');
    setMessages([
      {
        role: 'assistant',
        content: t({
          en: 'Tell me what report you need. I will ask 3 questions and search automatically.',
          zh: '请告诉我您需要哪一种表格。我会问 3 个问题，然后自动搜索。',
        }),
      },
    ]);

    fetch(`/api/navigate/questions?lang=${language}`)
      .then((response) => response.json())
      .then((data: { questions: ReportQuestion[] }) => {
        setQuestions(data.questions);
        setMessages((current) => [...current, { role: 'assistant', content: data.questions[0].label }]);
      });
  }, [language, t]);

  async function search(nextAnswers: Record<string, string>) {
    setLoading(true);
    const response = await fetch('/api/navigate/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: nextAnswers, other: '', language }),
    });
    const data = await response.json();
    setPayload(data);
    setSelected(data.results[0] ?? null);
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content:
          data.results.length > 0
            ? t({ en: `I found ${data.results.length} report result(s).`, zh: `我找到 ${data.results.length} 个表格结果。` })
            : t({ en: 'I could not find a match yet.', zh: '目前还没有找到匹配结果。' }),
      },
    ]);
    setLoading(false);
  }

  async function answerCurrentQuestion(value: string) {
    if (!currentQuestion || !value.trim() || loading) return;
    const answer = value.trim();
    const nextAnswers = { ...answers, [currentQuestion.id]: answer };
    const nextIndex = questionIndex + 1;

    setAnswers(nextAnswers);
    setMessages((current) => [...current, { role: 'user', content: answer }]);
    setInput('');

    if (nextIndex < questions.length) {
      setQuestionIndex(nextIndex);
      setMessages((current) => [...current, { role: 'assistant', content: questions[nextIndex].label }]);
      return;
    }

    await search(nextAnswers);
  }

  async function explainSearch() {
    if (!payload) return;
    const response = await fetch('/api/navigate/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: payload.keywords,
        selectedReportId: selected?.id,
        language,
      }),
    });
    const data = await response.json();
    setInsight(data.insight);
    speak(data.insight.spokenSummary, language === 'zh' ? 'zh' : 'en');
  }

  async function saveFavorite(report: ReportResult) {
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId: report.id }),
    });
    const data = await response.json();
    setMessage(
      response.ok
        ? t({ en: data.message ?? `${report.title} saved.`, zh: `${report.title} 已加入收藏。` })
        : t({ en: data.error ?? 'Save failed.', zh: '收藏失败。' }),
    );
  }

  return (
    <div className="wa-layout">
      <section className="wa-chat">
        <div className="wa-chat-header">
          <div className="wa-avatar">N</div>
          <div>
            <strong>{t({ en: 'Navigate Chatbot', zh: '找表格聊天助手' })}</strong>
            <span>{t({ en: 'Choose answers or speak into the message box', zh: '可以点击答案，也可以对输入框说话' })}</span>
          </div>
        </div>

        <div className="wa-stream">
          {messages.map((item, index) => (
            <div className={`wa-bubble ${item.role === 'user' ? 'user' : ''}`} key={`${item.role}-${index}`}>
              {item.content}
            </div>
          ))}

          {currentQuestion && !searchDone ? (
            <div className="quick-options">
              {currentQuestion.options.map((option) => (
                <button className="chip-button" key={option} type="button" onClick={() => answerCurrentQuestion(option)}>
                  {option}
                </button>
              ))}
            </div>
          ) : null}
          {loading ? <div className="wa-bubble">{t({ en: 'Searching reports...', zh: '正在搜索表格...' })}</div> : null}
        </div>

        <VoiceComposer
          value={input}
          onChange={setInput}
          onSubmit={() => answerCurrentQuestion(input)}
          placeholder={currentQuestion ? t({ en: 'Type or speak your answer', zh: '输入或说出您的答案' }) : t({ en: 'Search completed', zh: '搜索已完成' })}
          disabled={!currentQuestion || searchDone || loading}
          languageCode={language === 'zh' ? 'zh-CN' : 'en-US'}
        />
      </section>

      <aside className="result-panel large">
        <div className="section-head">
          <h2 className="module-title">
            <span className="icon-pill">
              <FileSearch size={22} />
            </span>
            {t({ en: 'Search Result', zh: '搜索结果' })}
          </h2>
          {payload ? (
            <button className="btn" type="button" onClick={explainSearch}>
              <Sparkles size={18} />
              {t({ en: 'Explain', zh: '说明' })}
            </button>
          ) : null}
        </div>

        {message ? <div className="notice">{message}</div> : null}

        {payload ? (
          <>
            <div className="result-success">
              <CheckCircle2 size={20} />
              {t({ en: `${payload.results.length} result(s)`, zh: `${payload.results.length} 个结果` })}
            </div>
            <div className="keyword-row">
              {payload.keywords.map((keyword) => (
                <span className="chip" key={keyword}>
                  {keyword}
                </span>
              ))}
            </div>

            <div className="side-list">
              {payload.results.map((report) => (
                <button
                  className={`list-button ${selected?.id === report.id ? 'active' : ''}`}
                  key={report.id}
                  type="button"
                  onClick={() => setSelected(report)}
                >
                  <strong>{report.title}</strong>
                  <small>
                    {report.category} - {report.owner} - {report.status}
                  </small>
                </button>
              ))}
            </div>

            {selected ? (
              <div className="detail-panel">
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr>
                        <th>{t({ en: 'ID', zh: 'ID' })}</th>
                        <td>{selected.id}</td>
                      </tr>
                      <tr>
                        <th>{t({ en: 'Updated', zh: '更新日期' })}</th>
                        <td>{selected.updatedAt}</td>
                      </tr>
                      <tr>
                        <th>{t({ en: 'Summary', zh: '摘要' })}</th>
                        <td>{selected.summary}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="button-row">
                  <button className="btn" type="button" onClick={() => saveFavorite(selected)}>
                    <BookmarkPlus size={18} />
                    {t({ en: 'Favorite', zh: '收藏' })}
                  </button>
                  <Link className="btn primary" href={`/view?reportId=${selected.id}`}>
                    {t({ en: 'Open PDF', zh: '打开 PDF' })}
                  </Link>
                </div>
              </div>
            ) : null}

            {insight ? (
              <div className="insight-panel" style={{ marginTop: 14 }}>
                <span className="status">
                  {insight.confidence} {t({ en: 'confidence', zh: '信心' })}
                </span>
                <p>{insight.spokenSummary}</p>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty-state">{t({ en: 'Search results will appear here after the chatbot gets 3 answers.', zh: '聊天助手取得 3 个答案后，搜索结果会显示在这里。' })}</div>
        )}
      </aside>
    </div>
  );
}
