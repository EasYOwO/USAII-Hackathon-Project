'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string };
  }>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  visible?: boolean;
  languageCode?: string;
  listeningLabel?: string;
  idleLabel?: string;
  tapHint?: string;
  unsupportedHint?: string;
  variant?: 'center' | 'bar';
};

export function VoiceComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  visible = true,
  languageCode = 'en-US',
  listeningLabel = 'Recording',
  idleLabel = 'Tap to speak',
  tapHint,
  unsupportedHint = 'Voice input is not supported in this browser.',
  variant = 'center',
}: VoiceComposerProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningWantedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    setVoiceAvailable(Boolean(Recognition));

    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageCode;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (transcript) onChange(transcript);
    };
    recognition.onend = () => {
      if (!listeningWantedRef.current || disabled) {
        setListening(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        listeningWantedRef.current = false;
        setListening(false);
      }
    };
    recognition.onerror = () => {
      listeningWantedRef.current = false;
      setListening(false);
    };
    recognitionRef.current = recognition;

    return () => {
      listeningWantedRef.current = false;
      recognition.stop();
    };
  }, [disabled, languageCode, onChange]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function toggleListening() {
    if (disabled) return;
    if (!recognitionRef.current) {
      setNotice(unsupportedHint);
      return;
    }
    if (listening) {
      listeningWantedRef.current = false;
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setNotice('');
    try {
      listeningWantedRef.current = true;
      recognitionRef.current.start();
      setListening(true);
    } catch {
      listeningWantedRef.current = false;
      setListening(false);
      setNotice(unsupportedHint);
    }
  }

  if (!visible) return null;

  if (variant === 'center') {
    return (
      <div className="voice-composer-wrap voice-center-wrap">
        {tapHint ? <p className="voice-tap-hint">{tapHint}</p> : null}
        <button
          className={`mic-large-btn ${listening ? 'recording' : ''}`}
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          aria-pressed={listening}
          title={voiceAvailable ? (listening ? 'Stop recording' : 'Start recording') : unsupportedHint}
        >
          {listening ? <MicOff size={42} /> : <Mic size={42} />}
        </button>
        <div className={`mic-status-pill ${listening ? 'on' : 'off'}`}>
          {listening ? listeningLabel : idleLabel}
        </div>
        {notice ? <div className="notice">{notice}</div> : null}
        <form className="voice-composer voice-composer-inline" onSubmit={handleSubmit}>
          <input
            className="voice-input"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button className="round-btn primary" type="submit" disabled={disabled || !value.trim()} title="Send">
            <Send size={20} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="voice-composer-wrap">
      {tapHint ? <p className="voice-tap-hint">{tapHint}</p> : null}
      <div className={`mic-status-pill ${listening ? 'on' : 'off'}`}>
        {listening ? listeningLabel : idleLabel}
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      <form className="voice-composer" onSubmit={handleSubmit}>
        <input
          className="voice-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          className={`round-btn mic-btn ${listening ? 'recording' : ''}`}
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          title={voiceAvailable ? (listening ? 'Stop recording' : 'Start recording') : unsupportedHint}
          aria-pressed={listening}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button className="round-btn primary" type="submit" disabled={disabled || !value.trim()} title="Send">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
