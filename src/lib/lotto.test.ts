import { describe, it, expect } from "vitest";
import type { Draw } from "../types";
import { frequency, gaps, patterns, NUMS } from "./stats";
import { sectionOf, moduleD, moduleF } from "./modules";
import { recommend } from "./recommend";
import { runPipeline } from "./pipeline";

// 테스트용 가짜 회차 데이터
const mk = (drwNo: number, numbers: number[], bonus = 7): Draw => ({
  drwNo,
  drwNoDate: "2026-01-01",
  numbers,
  bonus,
  firstWinamnt: 0,
  firstPrzwnerCo: 0,
  totSellamnt: 0,
});
const DRAWS: Draw[] = [
  mk(1, [1, 2, 3, 4, 5, 6]),
  mk(2, [1, 2, 3, 10, 20, 45]),
  mk(3, [1, 11, 21, 31, 41, 44]),
  mk(4, [5, 15, 25, 35, 40, 42]),
  mk(5, [2, 12, 22, 32, 38, 43]),
];

const isValidCombo = (c: number[]) =>
  c.length === 6 &&
  new Set(c).size === 6 &&
  c.every((n) => Number.isInteger(n) && n >= 1 && n <= 45);

describe("stats", () => {
  it("frequency: 총합은 회차×6, 번호 1은 3회", () => {
    const f = frequency(DRAWS);
    const total = NUMS.reduce((s, n) => s + f[n], 0);
    expect(total).toBe(DRAWS.length * 6);
    expect(f[1]).toBe(3);
  });

  it("gaps: 최신 회차에 나온 번호는 미출현 0", () => {
    const g = gaps(DRAWS);
    expect(g[2]).toBe(0); // 2번은 5회차(최신)에 등장
  });

  it("patterns: 비율은 0~100 범위", () => {
    const p = patterns(DRAWS);
    expect(p.oddPct).toBeGreaterThanOrEqual(0);
    expect(p.oddPct).toBeLessThanOrEqual(100);
    expect(p.bins).toHaveLength(5);
  });
});

describe("modules", () => {
  it("sectionOf: 구간 경계", () => {
    expect(sectionOf(1)).toBe(1);
    expect(sectionOf(10)).toBe(1);
    expect(sectionOf(11)).toBe(2);
    expect(sectionOf(40)).toBe(4);
    expect(sectionOf(41)).toBe(5);
    expect(sectionOf(45)).toBe(5);
  });

  it("moduleD: 저/중/고 비율 합은 ~100", () => {
    const d = moduleD(DRAWS);
    const sum = d.act.low + d.act.mid + d.act.high;
    expect(Math.round(sum)).toBe(100);
    expect(["양호", "보통", "불안정"]).toContain(d.grade);
  });

  it("moduleF: 45칸 셀 + 카운트 합 = 회차×6", () => {
    const m = moduleF(DRAWS, 30);
    expect(m.cells).toHaveLength(45);
    const sum = m.cells.reduce((s, c) => s + c.count, 0);
    expect(sum).toBe(DRAWS.length * 6);
  });
});

describe("recommend", () => {
  it("모든 모드가 유효한 6개 조합 반환", () => {
    for (const mode of ["frequency", "overdue", "balanced", "random"] as const) {
      expect(isValidCombo(recommend(DRAWS, mode).numbers)).toBe(true);
    }
  });

  it("제외 번호는 결과에 포함되지 않음", () => {
    const exclude = [1, 2, 3, 4, 5, 6];
    for (const mode of ["frequency", "overdue", "balanced", "random"] as const) {
      const { numbers } = recommend(DRAWS, mode, exclude);
      expect(isValidCombo(numbers)).toBe(true);
      expect(numbers.some((n) => exclude.includes(n))).toBe(false);
    }
  });
});

describe("pipeline", () => {
  it("상위 5개 이하의 유효 조합 + 점수 반환", () => {
    const res = runPipeline(DRAWS);
    expect(res.combos.length).toBeGreaterThan(0);
    expect(res.combos.length).toBeLessThanOrEqual(5);
    for (const c of res.combos) {
      expect(isValidCombo(c.numbers)).toBe(true);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it("제외 번호는 모든 조합에서 빠짐", () => {
    const exclude = [1, 2, 3];
    const res = runPipeline(DRAWS, exclude);
    for (const c of res.combos) {
      expect(c.numbers.some((n) => exclude.includes(n))).toBe(false);
    }
  });
});
