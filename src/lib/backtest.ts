// 백테스트 — 과거 각 회차 직전까지의 데이터로 9단계 파이프라인을 돌려
// 그 회차 실제 당첨번호와 몇 개 맞았는지 검증한다. (방법론의 "검증" 철학)
// ⚠️ 로또는 독립 시행이라 랜덤 기대값을 의미있게 넘기 어렵다 — 정직한 검증용.
import type { Draw } from "../types";
import { runPipeline } from "./pipeline";

export interface BacktestResult {
  n: number;
  avgMatch: number;
  randomExpected: number; // 이론 기대값 = 6×6/45 = 0.8
  randomSimAvg: number; // 실제 랜덤 시뮬레이션 평균 적중
  randomSims: number; // 랜덤 시뮬 총 횟수
  rankDist: Record<string, number>;
  best: { drwNo: number; matchCount: number; rank: string } | null;
}

// 1~45에서 중복 없이 6개 무작위 추출
function randomPick(): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 0; i < 6; i++) {
    const j = i + Math.floor(Math.random() * (45 - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 6);
}

const RANKS = ["1등", "2등", "3등", "4등", "5등", "꽝"] as const;

function rankOf(match: number, bonusHit: boolean): string {
  if (match === 6) return "1등";
  if (match === 5 && bonusHit) return "2등";
  if (match === 5) return "3등";
  if (match === 4) return "4등";
  if (match === 3) return "5등";
  return "꽝";
}

export function runBacktest(draws: Draw[], lookback = 50, minHistory = 30): BacktestResult {
  const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
  const rankDist: Record<string, number> = Object.fromEntries(RANKS.map((r) => [r, 0]));
  let totalMatch = 0;
  let count = 0;
  let best: BacktestResult["best"] = null;

  // 검증 대상 = 과거 데이터(minHistory 이상)가 확보되는 최근 lookback 회차
  const targets = sorted.slice(-lookback).filter((t) => sorted.filter((d) => d.drwNo < t.drwNo).length >= minHistory);

  // 랜덤 대조군: 같은 대상 회차들에 대해 회차당 simsPerDraw번 무작위 추출
  const simsPerDraw = Math.max(1, Math.ceil(1000 / Math.max(1, targets.length)));
  let randTotal = 0;
  let randSims = 0;

  for (const target of targets) {
    const history = sorted.filter((d) => d.drwNo < target.drwNo);
    const actual = new Set(target.numbers);

    // 파이프라인 추천
    const pick = runPipeline(history).combos[0]?.numbers ?? [];
    const matched = pick.filter((n) => actual.has(n));
    const match = matched.length;
    const bonusHit = match === 5 && pick.filter((n) => !actual.has(n)).includes(target.bonus);
    rankDist[rankOf(match, bonusHit)]++;
    totalMatch += match;
    count++;
    if (!best || match > best.matchCount) best = { drwNo: target.drwNo, matchCount: match, rank: rankOf(match, bonusHit) };

    // 랜덤 대조군
    for (let s = 0; s < simsPerDraw; s++) {
      randTotal += randomPick().filter((n) => actual.has(n)).length;
      randSims++;
    }
  }

  return {
    n: count,
    avgMatch: count ? totalMatch / count : 0,
    randomExpected: (6 * 6) / 45,
    randomSimAvg: randSims ? randTotal / randSims : 0,
    randomSims: randSims,
    rankDist,
    best,
  };
}
