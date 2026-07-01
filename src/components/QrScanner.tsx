import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

function CameraView({ onDetect }: { onDetect: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let rafId = 0;
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const v = videoRef.current!;
        v.srcObject = s;
        v.play().then(tick).catch(() => { if (!stopped) tick(); });
      })
      .catch(() => setCamError("카메라 접근 권한이 필요합니다.\n브라우저 설정에서 카메라를 허용해 주세요."));

    function tick() {
      if (stopped) return;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2 || v.videoWidth === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (c.width !== v.videoWidth) c.width = v.videoWidth;
      if (c.height !== v.videoHeight) c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (!ctx) { rafId = requestAnimationFrame(tick); return; }
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) {
        stopped = true;
        stream?.getTracks().forEach((t) => t.stop());
        onDetect(code.data);
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect]);

  if (camError) {
    return (
      <div className="qr-error-area">
        <div className="qr-error-icon">📷</div>
        <p className="qr-error-msg">{camError}</p>
      </div>
    );
  }

  return (
    <div className="qr-viewfinder">
      <video ref={videoRef} className="qr-video" muted playsInline />
      <canvas ref={canvasRef} className="qr-canvas" />
      <div className="qr-frame">
        <span className="qr-corner qr-tl" />
        <span className="qr-corner qr-tr" />
        <span className="qr-corner qr-bl" />
        <span className="qr-corner qr-br" />
      </div>
      <p className="qr-hint">복권 QR 코드를 네모 안에 비춰주세요</p>
    </div>
  );
}

export default function QrScanner({ onClose }: { onClose: () => void }) {
  const [scanned, setScanned] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const handleDetect = (text: string) => setScanned(text);
  const handleReset = () => { setScanned(null); setScanKey((k) => k + 1); };
  const handleOpen = () => { if (scanned) window.open(scanned, "_blank", "noopener"); };

  return (
    <div className="qr-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qr-modal">
        <div className="qr-header">
          <span className="qr-title">복권 QR 스캔</span>
          <button className="qr-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {!scanned ? (
          <CameraView key={scanKey} onDetect={handleDetect} />
        ) : (
          <div className="qr-result-area">
            <div className="qr-prize-badge qr-detected">QR 인식 완료</div>
            <p className="qr-drwno qr-url-text">{scanned}</p>
            <button className="btn-filled" onClick={handleOpen}>
              당첨 결과 확인하기
            </button>
            <button className="btn-tinted" style={{ width: "100%", marginTop: 8 }} onClick={handleReset}>
              다시 스캔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
