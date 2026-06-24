// 로또 분석 방법론 — 8대 모듈 엔진 (Phase 1: A, D, F)
// ⚠️ 로또는 독립·균등 시행이라 어떤 모듈도 당첨 확률을 높이지 못함. 통계적 분석/시뮬레이션 용도.
import type { Draw } from "../types";

export const SECTIONS = [
  { key: 1, label: "1구간", range: "1–10", lo: 1, hi: 10 },
  { key: 2, label: "2구간", range: "11–20", lo: 11, hi: 20 },
  { key: 3, label: "3구간", range: "21–30", lo: 21, hi: 30 },
  { key: 4, label: "4구간", range: "31–40", lo: 31, hi: 40 },
  { key: 5, label: "5구간", range: "41–45", lo: 41, hi: 45 },
] as const;

export function sectionOf(n: number): number {
  return n <= 10 ? 1 : n <= 20 ? 2 : n <= 30 ? 3 : n <= 40 ? 4 : 5;
}

const sortAsc = (draws: Draw[]) => [...draws].sort((a, b) => a.drwNo - b.drwNo);
const NUM45 = Array.from({ length: 45 }, (_, i) => i + 1);

// ── 모듈 A. 구간 흐름 분석 (Flow Tracker) ──
// 단기(최근5) vs 장기(최근20) 구간 출현 비교 + 변동성으로 흐름 상태 라벨.
export type FlowState = "강세 유지" | "약화 흐름" | "변동성 확대" | "재정비 구간" | "관망";

export function moduleA(draws: Draw[]) {
  const sorted = sortAsc(draws);
  const tail = (k: number) => sorted.slice(-k);
  const short = tail(5);
  const long = tail(20);
  const countIn = (set: Draw[], sec: number) =>
    set.reduce((s, d) => s + d.numbers.filter((n) => sectionOf(n) === sec).length, 0);

  return SECTIONS.map((S) => {
    const sCount = countIn(short, S.key);
    const lCount = countIn(long, S.key);
    const shortAvg = short.length ? sCount / short.length : 0;
    const longAvg = long.length ? lCount / long.length : 0;
    const last10 = tail(10).map((d) => d.numbers.filter((n) => sectionOf(n) === S.key).length);
    const mean = last10.reduce((a, b) => a + b, 0) / (last10.length || 1);
    const std = Math.sqrt(last10.reduce((a, b) => a + (b - mean) ** 2, 0) / (last10.length || 1));
    const ratio = longAvg ? shortAvg / longAvg : shortAvg ? 2 : 0;

    let state: FlowState;
    if (sCount === 0 && lCount > 0) state = "재정비 구간";
    else if (std >= 1.0 && mean > 0) state = "변동성 확대";
    else if (ratio >= 1.2) state = "강세 유지";
    else if (ratio <= 0.8) state = "약화 흐름";
    else state = "관망";

    return { ...S, shortAvg, longAvg, ratio, state };
  });
}

// ── 모듈 D. 분산 구조 안정성 (Distribution Stability) ──
// 저(1-20)/중(21-40)/고(41-45) 출현 비율을 '번호 개수 비례 기대치'와 비교해 편차·등급 산출.
export function moduleD(draws: Draw[]) {
  let low = 0, mid = 0, high = 0;
  for (const d of draws)
    for (const n of d.numbers) {
      if (n <= 20) low++;
      else if (n <= 40) mid++;
      else high++;
    }
  const total = low + mid + high || 1;
  const act = { low: (low / total) * 100, mid: (mid / total) * 100, high: (high / total) * 100 };
  // 기대 비율 = 구간별 번호 개수 비례 (저 20/45, 중 20/45, 고 5/45)
  const exp = { low: (20 / 45) * 100, mid: (20 / 45) * 100, high: (5 / 45) * 100 };
  const deviation =
    Math.abs(act.low - exp.low) + Math.abs(act.mid - exp.mid) + Math.abs(act.high - exp.high);
  const grade: "양호" | "보통" | "불안정" =
    deviation < 6 ? "양호" : deviation < 14 ? "보통" : "불안정";
  return { act, exp, deviation, grade };
}

// ── 모듈 F. 이진 출현 매트릭스 (Binary Matrix) ──
// 최근 N회 기준 각 번호 출현 횟수(히트맵) + 공백(미출현)/밀집(과열) 리포트.
export function moduleF(draws: Draw[], windowN = 30) {
  const win = sortAsc(draws).slice(-windowN);
  const counts: Record<number, number> = {};
  const lastIdx: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) counts[n] = 0;
  win.forEach((d, i) => d.numbers.forEach((n) => { counts[n]++; lastIdx[n] = i; }));

  const cells = Array.from({ length: 45 }, (_, i) => {
    const n = i + 1;
    const gap = lastIdx[n] === undefined ? win.length : win.length - 1 - lastIdx[n];
    return { n, count: counts[n], gap };
  });
  const maxCount = Math.max(...cells.map((c) => c.count), 1);
  const blankThreshold = Math.min(10, win.length);
  const blanks = cells.filter((c) => c.gap >= blankThreshold).sort((a, b) => b.gap - a.gap).slice(0, 8);
  const dense = [...cells].sort((a, b) => b.count - a.count).slice(0, 8);
  return { window: win.length, cells, maxCount, blanks, dense };
}

// ── 모듈 E. 끝수 연결 패턴 (Tail Number) ──
// 1의 자리(0~9) 계열 출현 빈도 + 최근 집중 끝수(활성 계열) 감지.
export function moduleE(draws: Draw[]) {
  const freq = Array.from({ length: 10 }, (_, d) => ({ digit: d, count: 0 }));
  for (const d of draws) for (const n of d.numbers) freq[n % 10].count++;

  const recent = sortAsc(draws).slice(-5);
  const recentCount = Array(10).fill(0);
  for (const d of recent) for (const n of d.numbers) recentCount[n % 10]++;
  // 활성 끝수 = 최근 5회에서 평균(30/10=3)을 '초과'해 집중된 계열 상위 4개
  const avg = recentCount.reduce((a, b) => a + b, 0) / 10;
  const active = recentCount
    .map((c, digit) => ({ digit, c }))
    .filter((x) => x.c > avg && x.c >= 2)
    .sort((a, b) => b.c - a.c)
    .slice(0, 4)
    .map((x) => x.digit);

  return { freq, active, window: recent.length };
}

// ── 모듈 H. 인접 클러스터 분석 (Adjacent Cluster) ──
// 각 번호 출현 회차에서 ±1~3 이웃 번호의 동반 출현 횟수로 클러스터 강도 산출.
export function moduleH(draws: Draw[]) {
  const score: Record<number, number> = {};
  const appear: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) { score[n] = 0; appear[n] = 0; }
  for (const d of draws) {
    const set = d.numbers;
    for (const n of set) {
      appear[n]++;
      for (const m of set) {
        const diff = Math.abs(m - n);
        if (diff >= 1 && diff <= 3) score[n]++;
      }
    }
  }
  const top = NUM45.map((n) => ({ n, score: score[n], appear: appear[n] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  return { top };
}

// ── 모듈 B. 영향력 지수 (Influence Index) ──
// 구간별 = 출현빈도 × 연속출현가중 × 분산안정성 → 0~100 점수 + 과열/저평가 플래그.
export function moduleB(draws: Draw[]) {
  const sorted = sortAsc(draws);
  const n = sorted.length || 1;

  const rows = SECTIONS.map((S) => {
    const perDraw = sorted.map((d) => d.numbers.filter((x) => sectionOf(x) === S.key).length);
    const freq = perDraw.reduce((a, b) => a + b, 0);
    const appearRate = perDraw.filter((c) => c > 0).length / n; // 출현 빈도(0~1)
    let consecPairs = 0;
    for (let i = 1; i < perDraw.length; i++) if (perDraw[i] > 0 && perDraw[i - 1] > 0) consecPairs++;
    const consecWeight = perDraw.length > 1 ? consecPairs / (perDraw.length - 1) : 0; // 연속출현 가중(0~1)
    const mean = freq / n;
    const std = Math.sqrt(perDraw.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    const stability = 1 / (1 + (mean ? std / mean : 0)); // 분산 안정성(0~1)
    const raw = appearRate * (0.5 + 0.5 * consecWeight) * stability;

    const recentAvg = sorted.slice(-5).reduce((a, d) => a + d.numbers.filter((x) => sectionOf(x) === S.key).length, 0) / Math.min(5, n);
    return { ...S, freq, appearRate, consecWeight, stability, raw, recentAvg, longAvg: mean };
  });

  const maxRaw = Math.max(...rows.map((r) => r.raw), 0.0001);
  const avgAppear = rows.reduce((a, r) => a + r.appearRate, 0) / rows.length;
  return rows
    .map((r) => {
      const score = Math.round((r.raw / maxRaw) * 100);
      let flag: "과열" | "저평가" | null = null;
      if (r.recentAvg >= r.longAvg * 1.4 && score < 60) flag = "과열";
      else if (r.appearRate < avgAppear && r.stability >= 0.6 && score < 55) flag = "저평가";
      return { key: r.key, label: r.label, range: r.range, score, flag };
    })
    .sort((a, b) => b.score - a.score);
}
