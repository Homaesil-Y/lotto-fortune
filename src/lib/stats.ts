import type { Draw } from "../types";

export const NUMS = Array.from({ length: 45 }, (_, i) => i + 1); // 1..45

// 번호별 누적 출현 횟수 (F2)
export function frequency(draws: Draw[]): Record<number, number> {
  const f: Record<number, number> = Object.fromEntries(NUMS.map((n) => [n, 0]));
  for (const d of draws) for (const n of d.numbers) f[n] += 1;
  return f;
}

// 번호별 미출현 기간 = 마지막 등장 이후 지난 회차 수 (F3)
export function gaps(draws: Draw[]): Record<number, number> {
  const lastSeen: Record<number, number> = {};
  const sorted = [...draws].sort((a, b) => a.drwNo - b.drwNo);
  const latest = sorted.at(-1)?.drwNo ?? 0;
  for (const d of sorted) for (const n of d.numbers) lastSeen[n] = d.drwNo;
  return Object.fromEntries(
    NUMS.map((n) => [n, lastSeen[n] ? latest - lastSeen[n] : sorted.length])
  );
}

// 패턴 분포: 홀짝 / 고저 / 5개 구간 (F4)
export function patterns(draws: Draw[]) {
  let odd = 0, even = 0, low = 0, high = 0;
  const bins = [0, 0, 0, 0, 0]; // 1-10,11-20,21-30,31-40,41-45
  for (const d of draws) {
    for (const n of d.numbers) {
      n % 2 ? odd++ : even++;
      n <= 22 ? low++ : high++;
      bins[Math.min(Math.floor((n - 1) / 10), 4)]++;
    }
  }
  const total = odd + even || 1;
  return {
    odd, even, low, high, bins,
    oddPct: Math.round((odd / total) * 100),
    lowPct: Math.round((low / total) * 100),
  };
}

// 끝자리(0~9) 출현 빈도 (F8)
export function lastDigits(draws: Draw[]): { digit: number; count: number }[] {
  const c = Array(10).fill(0);
  for (const d of draws) for (const n of d.numbers) c[n % 10] += 1;
  return c.map((count, digit) => ({ digit, count }));
}

// 연속번호 분석 (F8): 한 회차에 연속 쌍(예: 7,8)이 N개인 회차가 몇 번 있었는지
export function consecutive(draws: Draw[]) {
  const dist: Record<number, number> = {}; // 연속쌍 개수 -> 회차 수
  let withConsec = 0;
  for (const d of draws) {
    const s = [...d.numbers].sort((a, b) => a - b);
    let pairs = 0;
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] === 1) pairs += 1;
    dist[pairs] = (dist[pairs] ?? 0) + 1;
    if (pairs > 0) withConsec += 1;
  }
  return {
    dist, // {0: x, 1: y, 2: z, ...}
    withConsecPct: draws.length ? Math.round((withConsec / draws.length) * 100) : 0,
  };
}

export const latest = (draws: Draw[]) =>
  draws.reduce((a, b) => (b.drwNo > a.drwNo ? b : a), draws[0]);

// 회차별 출현(핫)/미출현(콜드) 현황: 각 회차 당첨번호 6개 중
// 직전 windowN회 안에 나온 적 있는 수(hot) vs 없던 수(cold). 합 = 6.
// prior 계산은 전체 데이터 기준(allDraws), 표시 대상만 targets.
export function hotColdByDraw(allDraws: Draw[], targets: Draw[], windowN = 10) {
  const sorted = [...allDraws].sort((a, b) => a.drwNo - b.drwNo);
  return targets.map((t) => {
    const prior = sorted.filter((d) => d.drwNo < t.drwNo).slice(-windowN);
    const priorSet = new Set(prior.flatMap((d) => d.numbers));
    const hot = t.numbers.filter((n) => priorSet.has(n)).length;
    return { drwNo: t.drwNo, drwNoDate: t.drwNoDate, hot, cold: 6 - hot, priorN: prior.length };
  });
}
