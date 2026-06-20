'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react';

type IdDocumentCaptureProps = {
  username: string;
  language: 'en' | 'zh' | 'ms';
  onComplete: (fileName: string) => void;
  labels: {
    title: string;
    front: string;
    back: string;
    capture: string;
    retake: string;
    submit: string;
    ready: string;
    needBoth: string;
    working: string;
  };
};

type CaptureSide = 'front' | 'back';

export function IdDocumentCapture({ username, language, onComplete, labels }: IdDocumentCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [side, setSide] = useState<CaptureSide>('front');
  const [frontBlob, setFrontBlob] = useState<Blob | null>(null);
  const [backBlob, setBackBlob] = useState<Blob | null>(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [backPreview, setBackPreview] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
        setError('');
      } catch {
        setError(language === 'zh' ? '无法打开相机，请检查浏览器权限。' : 'Cannot open camera. Please allow camera permission.');
      }
    }

    void startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [language]);

  function captureCurrentSide() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      if (side === 'front') {
        setFrontBlob(blob);
        setFrontPreview(url);
        setSide('back');
      } else {
        setBackBlob(blob);
        setBackPreview(url);
      }
    }, 'image/jpeg', 0.92);
  }

  async function submitDocument() {
    if (!frontBlob || !backBlob) {
      setError(labels.needBoth);
      return;
    }
    setBusy(true);
    setError('');
    const formData = new FormData();
    formData.append('username', username);
    formData.append('front', frontBlob, 'front.jpg');
    formData.append('back', backBlob, 'back.jpg');
    const response = await fetch('/api/pdf/id-document', { method: 'POST', body: formData });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? labels.working);
      return;
    }
    onComplete(data.fileName as string);
  }

  return (
    <div className="id-capture-panel">
      <h3>{labels.title}</h3>
      <p>{side === 'front' ? labels.front : labels.back}</p>
      <div className="id-capture-stage">
        <video ref={videoRef} className="id-capture-video" playsInline muted />
        {!cameraReady ? <div className="id-capture-overlay">{labels.working}</div> : null}
      </div>
      <div className="id-capture-previews">
        <div className={frontPreview ? 'ready' : ''}>
          <span>{labels.front}</span>
          {frontPreview ? <img src={frontPreview} alt="Front ID" /> : null}
        </div>
        <div className={backPreview ? 'ready' : ''}>
          <span>{labels.back}</span>
          {backPreview ? <img src={backPreview} alt="Back ID" /> : null}
        </div>
      </div>
      {error ? <div className="notice">{error}</div> : null}
      <div className="button-row">
        <button className="btn" type="button" onClick={captureCurrentSide} disabled={!cameraReady || busy}>
          <Camera size={18} />
          {labels.capture}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            setSide('front');
            setFrontBlob(null);
            setBackBlob(null);
            setFrontPreview('');
            setBackPreview('');
          }}
          disabled={busy}
        >
          <RefreshCw size={18} />
          {labels.retake}
        </button>
        <button className="btn primary" type="button" onClick={() => void submitDocument()} disabled={!frontBlob || !backBlob || busy}>
          <CheckCircle2 size={18} />
          {labels.submit}
        </button>
      </div>
      {frontBlob && backBlob ? <div className="notice ok">{labels.ready}</div> : null}
    </div>
  );
}
