import type { Draw, RecommendMode } from "../types";
import { NUMS, frequency, gaps } from "./stats";

// 가중치 기반 비복원 추출로 6개 번호 선택 (exclude 번호는 후보에서 제외)
function weightedPick(weights: Record<number, number>, exclude: Set<number>): number[] {
  const pool = NUMS.filter((n) => !exclude.has(n)).map((n) => ({ n, w: Math.max(weights[n], 0.0001) }));
  const out: number[] = [];
  while (out.length < 6 && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * total;
    let i = 0;
    while (r > pool[i].w) r -= pool[i++].w;
    out.push(pool[i].n);
    pool.splice(i, 1);
  }
  return out.sort((a, b) => a - b);
}

export interface Recommendation {
  numbers: number[];
  reason: string;
}

export function recommend(draws: Draw[], mode: RecommendMode, exclude: number[] = []): Recommendation {
  const ex = new Set(exclude);
  const exNote = ex.size ? ` (제외 ${exclude.length}개 반영)` : "";
  switch (mode) {
    case "frequency": {
      const f = frequency(draws);
      return { numbers: weightedPick(f, ex), reason: "출현 빈도가 높은 번호에 가중치를 둬 선택했습니다." + exNote };
    }
    case "overdue": {
      const g = gaps(draws);
      return { numbers: weightedPick(g, ex), reason: "오래 안 나온(미출현 기간이 긴) 번호에 가중치를 둬 선택했습니다." + exNote };
    }
    case "balanced": {
      // 홀짝 3:3, 저(1-22)/고(23-45) 3:3 을 맞춘 균형 추출 (제외 번호 반영)
      const avail = NUMS.filter((n) => !ex.has(n));
      const odds = avail.filter((n) => n % 2);
      const evens = avail.filter((n) => !(n % 2));
      const sample = (arr: number[], k: number) =>
        [...arr].sort(() => Math.random() - 0.5).slice(0, k);
      const set = new Set([...sample(odds, 3), ...sample(evens, 3)]);
      while (set.size < 6) set.add(avail[Math.floor(Math.random() * avail.length)]);
      const lowCount = [...set].filter((n) => n <= 22).length;
      return {
        numbers: [...set].sort((a, b) => a - b),
        reason: `홀짝 균형(약 3:3), 저:고 ${lowCount}:${6 - lowCount} 분포에 맞춰 선택했습니다.` + exNote,
      };
    }
    case "random":
    default: {
      const flat = Object.fromEntries(NUMS.map((n) => [n, 1]));
      return { numbers: weightedPick(flat, ex), reason: "통계와 무관한 순수 랜덤 추출입니다 (정직한 대조군)." + exNote };
    }
  }
}
