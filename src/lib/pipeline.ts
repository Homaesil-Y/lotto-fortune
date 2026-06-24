// 9단계 후보 선별 파이프라인 — 6개 모듈(A·B·D·E·F·H)을 순서대로 필터·가중.
// 모듈 C(중심축)·G(체인)은 H 클러스터로 근사. ⚠️ 통계 시뮬레이션이며 당첨을 보장하지 않음.
import type { Draw } from "../types";
import { moduleA, moduleB, moduleE, moduleF, moduleH, sectionOf, type FlowState } from "./modules";

export interface PipelineCombo {
  numbers: number[];
  score: number; // 0~100 종합 점수
  report: { low: number; mid: number; high: number; flowStrong: number; avgInfluence: number; axisIncluded: boolean; tailActive: number };
}

export interface PipelineResult {
  combos: PipelineCombo[];
  poolSize: number;
  notes: string[];
}

const flowMul = (s: FlowState) =>
  s === "강세 유지" ? 1.0 : s === "재정비 구간" ? 0.8 : s === "관망" ? 0.6 : s === "변동성 확대" ? 0.5 : 0.35;

export function runPipeline(draws: Draw[]): PipelineResult {
  // 모듈 산출
  const flow = moduleA(draws);
  const infl = moduleB(draws);
  const tail = moduleE(draws);
  const matrix = moduleF(draws);
  const cluster = moduleH(draws);

  const flowBySec = Object.fromEntries(flow.map((f) => [f.key, f.state])) as Record<number, FlowState>;
  const inflBySec = Object.fromEntries(infl.map((r) => [r.key, r.score])) as Record<number, number>;
  const activeTails = new Set(tail.active);
  const blankSet = new Set(matrix.blanks.map((b) => b.n));
  const denseSet = new Set(matrix.dense.filter((d) => d.count > 0).map((d) => d.n));
  const clusterSet = new Set(cluster.top.map((c) => c.n));
  // 중심축(C) 근사 = 클러스터 상위 중 중구간(21~40) 번호
  const axis = new Set(cluster.top.map((c) => c.n).filter((n) => sectionOf(n) === 3 || sectionOf(n) === 4));

  // 1~6단계: 번호별 가중치 산출
  const weights: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) {
    const sec = sectionOf(n);
    let w = flowMul(flowBySec[sec]); // A 흐름
    w *= 0.4 + 0.6 * ((inflBySec[sec] ?? 0) / 100); // B 영향력
    if (activeTails.has(n % 10)) w *= 1.25; // E 끝수(소프트)
    if (blankSet.has(n)) w *= 1.2; // F 공백 재진입 가중
    if (denseSet.has(n)) w *= 0.7; // F 과열 패널티
    if (clusterSet.has(n)) w *= 1.3; // G+H 클러스터
    weights[n] = w;
  }
  const maxW = Math.max(...Object.values(weights), 0.0001);

  // 7~8단계: 가중 비복원 추출로 후보 조합 다수 생성 → 분산/중심축 점수화
  const sample = () => {
    const pool = Array.from({ length: 45 }, (_, i) => ({ n: i + 1, w: weights[i + 1] }));
    const out: number[] = [];
    while (out.length < 6 && pool.length) {
      const tot = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * tot;
      let i = 0;
      while (r > pool[i].w && i < pool.length - 1) { r -= pool[i].w; i++; }
      out.push(pool[i].n);
      pool.splice(i, 1);
    }
    return out.sort((a, b) => a - b);
  };

  const seen = new Set<string>();
  const cands: number[][] = [];
  for (let i = 0; i < 800 && cands.length < 250; i++) {
    const c = sample();
    const k = c.join(",");
    if (!seen.has(k)) { seen.add(k); cands.push(c); }
  }

  const scoreCombo = (c: number[]): PipelineCombo => {
    const low = c.filter((n) => n <= 20).length;
    const mid = c.filter((n) => n > 20 && n <= 40).length;
    const high = c.filter((n) => n > 40).length;
    // D 분산: 이상치(저3·중3·고0~1)에서 벗어날수록 감점
    const distPenalty = Math.abs(low - 3) + Math.abs(mid - 3) + Math.max(0, high - 1);
    const distScore = Math.max(0, 1 - distPenalty * 0.18);
    const wScore = c.reduce((s, n) => s + weights[n], 0) / 6 / maxW;
    const flowStrong = c.filter((n) => flowBySec[sectionOf(n)] === "강세 유지").length;
    const axisIncluded = c.some((n) => axis.has(n));
    const tailActive = c.filter((n) => activeTails.has(n % 10)).length;
    const avgInfluence = Math.round(c.reduce((s, n) => s + (inflBySec[sectionOf(n)] ?? 0), 0) / 6);
    const composite = 0.45 * wScore + 0.35 * distScore + 0.1 * (axisIncluded ? 1 : 0) + 0.1 * (flowStrong / 6);
    return { numbers: c, score: Math.round(composite * 100), report: { low, mid, high, flowStrong, avgInfluence, axisIncluded, tailActive } };
  };

  const combos = cands.map(scoreCombo).sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    combos,
    poolSize: Object.values(weights).filter((w) => w > 0).length,
    notes: ["모듈 C(중심축)·G(체인)은 H 클러스터로 근사함"],
  };
}
