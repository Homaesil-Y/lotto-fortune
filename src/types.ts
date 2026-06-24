// 정적 lotto.json 한 회차의 구조 (scripts/fetch-lotto.mjs 의 pick() 과 일치)
export interface Draw {
  drwNo: number;
  drwNoDate: string;
  numbers: number[]; // 당첨번호 6개
  bonus: number;
  firstWinamnt: number;
  firstPrzwnerCo: number;
  totSellamnt: number;
}

export type RecommendMode = "frequency" | "overdue" | "balanced" | "random";
