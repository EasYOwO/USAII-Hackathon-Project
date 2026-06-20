'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Sparkles, Table2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { VoiceComposer } from '@/components/VoiceComposer';

type Message = {
  role: 'assistant' | 'user';
  content: string;
};

type FillRecord = Record<string, any>;

type FillInsight = {
  spokenSummary: string;
  highlights: string[];
  confidence: 'High' | 'Medium' | 'Low';
};

function speak(text: string, language: 'en' | 'zh') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
  window.speechSynthesis.speak(utterance);
}

export function FillClient() {
  const { language, t } = useLanguage();
  
  const [sessionId] = useState(() => `session_${Math.floor(Math.random() * 10000)}_${Date.now()}`);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [record, setRecord] = useState<FillRecord>({});
  const [insight, setInsight] = useState<FillInsight | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [dialogState, setDialogState] = useState<string>('INIT');
  const completed = dialogState === 'COMPLETED';

  const rows = useMemo(() => {
    return Object.entries(record).map(([field, value]) => [
      field.charAt(0).toUpperCase() + field.slice(1), 
      String(value || '-')
    ]);
  }, [record]);

  useEffect(() => {
    setRecord({});
    setInsight(null);
    setDialogState('INIT');
    
    fetch('/api/fill/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: '你好，我进入网站了', 
        language: language === 'zh' ? 'zh_CN' : 'en_US'
      })
    })
    .then((res) => res.json())
    .then((data) => {
      if (data.reply) {
        setMessages([{ role: 'assistant', content: data.reply }]);
        setDialogState(data.newState || 'INIT');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function answerCurrentQuestion(value: string) {
    if (!value.trim() || loading || completed) return;
    
    const answer = value.trim();
    setMessages((current) => [...current, { role: 'user', content: answer }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/fill/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId, 
          message: answer, 
          language: language === 'zh' ? 'zh_CN' : 'en_US' 
        }),
      });
      
      const payload = await response.json();
      
      if (payload.reply) {
        setMessages((current) => [...current, { role: 'assistant', content: payload.reply }]);
        speak(payload.reply, language === 'zh' ? 'zh' : 'en');
      }
      if (payload.extractedData) {
        setRecord(payload.extractedData);
      }
      if (payload.newState) {
        setDialogState(payload.newState);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function explainResult() {
    if (!completed) return;
    const response = await fetch('/api/fill/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record, messages, language }),
    });
    const data = await response.json();
    setInsight(data.insight);
    speak(data.insight.spokenSummary, language === 'zh' ? 'zh' : 'en');
  }

  return (
    <div className="wa-layout">
      <section className="wa-chat">
        <div className="wa-chat-header">
          <div className="wa-avatar">F</div>
          <div>
            <strong>{t({ en: 'Fill Chatbot', zh: '填写聊天助手' })}</strong>
            <span>{t({ en: 'Talk with assistant to fill forms', zh: '和助手对话来填写表格' })}</span>
          </div>
        </div>

        <div className="wa-stream">
          {messages.map((message, index) => (
            <div className={`wa-bubble ${message.role === 'user' ? 'user' : ''}`} key={`${message.role}-${index}`}>
              {message.content}
            </div>
          ))}
          {/* Delete old version static option button */}
          {loading ? <div className="wa-bubble">{t({ en: 'Typing...', zh: '正在输入...' })}</div> : null}
        </div>

        <VoiceComposer
          value={input}
          onChange={setInput}
          onSubmit={() => answerCurrentQuestion(input)}
          placeholder={completed ? t({ en: 'Completed', zh: '已完成' }) : t({ en: 'Type or speak your answer', zh: '输入或说出您的答案' })}
          disabled={completed || loading}
          languageCode={language === 'zh' ? 'zh-CN' : 'en-US'}
        />
      </section>

      <aside className="result-panel large">
        <div className="section-head">
          <h2 className="module-title">
            <span className="icon-pill">
              <Table2 size={22} />
            </span>
            {t({ en: 'Result', zh: '结果' })}
          </h2>
          {completed ? (
            <button className="btn" type="button" onClick={explainResult}>
              <Sparkles size={18} />
              {t({ en: 'Explain', zh: '说明' })}
            </button>
          ) : null}
        </div>

        {Object.keys(record).length > 0 ? (
          <>
            {completed && (
              <div className="result-success">
                <CheckCircle2 size={20} />
                {t({ en: 'Result filled', zh: '结果已填写完毕' })}
              </div>
            )}
            <div className="table-wrap">
              <table>
                <tbody>
                  {rows.map(([field, value]) => (
                    <tr key={field}>
                      <th>{field}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <div className="empty-state">{t({ en: 'The filled result will appear here.', zh: '填写结果会显示在这里。' })}</div>
        )}
      </aside>
    </div>
  );
}