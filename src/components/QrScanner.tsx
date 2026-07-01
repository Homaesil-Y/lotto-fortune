import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import type { Draw } from "../types";

interface QrResult {
  drwNo: number;
  myNumbers: number[];
  draw: Draw | null;
  prize: string;
  matchCount: number;
  hasBonus: boolean;
}

function parseLottoQr(text: string): { drwNo: number; myNumbers: number[] } | null {
  try {
    const url = new URL(text);
    const v = url.searchParams.get("v");
    if (!v) return null;
    const qIdx = v.indexOf("q");
    if (qIdx < 0) return null;
    const drwNo = parseInt(v.slice(0, qIdx), 10);
    const numsStr = v.slice(qIdx + 1);
    if (isNaN(drwNo) || numsStr.length < 18) return null;
    const myNumbers: number[] = [];
    for (let i = 0; i < numsStr.length; i += 3) {
      const n = parseInt(numsStr.slice(i, i + 3), 10);
      if (!isNaN(n) && n >= 1 && n <= 45) myNumbers.push(n);
    }
    if (myNumbers.length !== 6) return null;
    return { drwNo, myNumbers };
  } catch {
    return null;
  }
}

function getPrize(myNumbers: number[], draw: Draw) {
  const winSet = new Set(draw.numbers);
  const matchCount = myNumbers.filter((n) => winSet.has(n)).length;
  const hasBonus = myNumbers.includes(draw.bonus);
  const prize =
    matchCount === 6 ? "1등"
    : matchCount === 5 && hasBonus ? "2등"
    : matchCount === 5 ? "3등"
    : matchCount === 4 ? "4등"
    : matchCount === 3 ? "5등"
    : "미당첨";
  return { prize, matchCount, hasBonus };
}

function CameraView({ draws, onResult }: { draws: Draw[]; onResult: (r: QrResult) => void }) {
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
      if (!v || !c || v.readyState < 2) { rafId = requestAnimationFrame(tick); return; }
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height);
      if (code?.data) {
        const parsed = parseLottoQr(code.data);
        if (parsed) {
          stopped = true;
          stream?.getTracks().forEach((t) => t.stop());
          const draw = draws.find((d) => d.drwNo === parsed.drwNo) ?? null;
          const { prize, matchCount, hasBonus } = draw
            ? getPrize(parsed.myNumbers, draw)
            : { prize: "데이터 없음", matchCount: 0, hasBonus: false };
          onResult({ ...parsed, draw, prize, matchCount, hasBonus });
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [draws, onResult]);

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

const PRIZE_LABEL: Record<string, string> = {
  "1등": "🏆 1등 당첨!",
  "2등": "🥈 2등 당첨!",
  "3등": "🥉 3등 당첨!",
  "4등": "🎉 4등 당첨!",
  "5등": "✅ 5등 당첨!",
  "미당첨": "😢 미당첨",
  "데이터 없음": "⚠️ 회차 데이터 없음",
};

export default function QrScanner({ draws, onClose }: { draws: Draw[]; onClose: () => void }) {
  const [result, setResult] = useState<QrResult | null>(null);
  const [scanKey, setScanKey] = useState(0);

  const handleResult = useCallback((r: QrResult) => setResult(r), []);
  const handleReset = () => { setResult(null); setScanKey((k) => k + 1); };

  const isWin = result && result.prize !== "미당첨" && result.prize !== "데이터 없음";

  return (
    <div className="qr-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qr-modal">
        <div className="qr-header">
          <span className="qr-title">복권 QR 스캔</span>
          <button className="qr-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        {!result ? (
          <CameraView key={scanKey} draws={draws} onResult={handleResult} />
        ) : (
          <div className="qr-result-area">
            <div className={`qr-prize-badge ${isWin ? "qr-win" : "qr-lose"}`}>
              {PRIZE_LABEL[result.prize] ?? result.prize}
            </div>

            <p className="qr-drwno">
              {result.drwNo}회{result.draw ? ` · ${result.draw.drwNoDate}` : ""}
            </p>

            <div className="qr-my-numbers">
              {result.myNumbers.map((n) => {
                const isMatch = result.draw?.numbers.includes(n);
                const isBonus = !isMatch && result.draw?.bonus === n;
                return (
                  <span
                    key={n}
                    className={`qr-num${isMatch ? " qr-match" : isBonus ? " qr-bonus" : ""}`}
                  >
                    {n}
                  </span>
                );
              })}
            </div>

            {result.draw && (
              <p className="qr-match-label">
                {result.matchCount}개 일치{result.hasBonus ? " + 보너스" : ""}
              </p>
            )}

            <button className="btn-filled" style={{ marginTop: 20 }} onClick={handleReset}>
              다시 스캔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
