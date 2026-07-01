import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { Draw, RecommendMode } from "./types";
import QrScanner from "./components/QrScanner";
import { NUMS, frequency, gaps, patterns, latest, consecutive, hotColdByDraw } from "./lib/stats";
import { recommend, type Recommendation } from "./lib/recommend";
import { moduleA, moduleD, moduleF, moduleE, moduleH, moduleB } from "./lib/modules";
import { runPipeline, type PipelineResult } from "./lib/pipeline";
import { runBacktest, type BacktestResult } from "./lib/backtest";

const FreqChart = lazy(() => import("./components/FreqChart"));

const FLOW_CLASS: Record<string, string> = {
  "강세 유지": "st-strong",
  "약화 흐름": "st-weak",
  "변동성 확대": "st-vol",
  "재정비 구간": "st-reset",
  "관망": "st-idle",
};

const MODES: { key: RecommendMode; label: string }[] = [
  { key: "frequency", label: "빈도" },
  { key: "overdue", label: "미출현" },
  { key: "balanced", label: "균형" },
  { key: "random", label: "랜덤" },
];

const ballClass = (n: number) =>
  n <= 10 ? "b-amber" : n <= 20 ? "b-blue" : n <= 30 ? "b-coral" : n <= 40 ? "b-gray" : "b-green";

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 36 36" width="36" height="36" role="img" aria-label="로또랩 로고">
      <rect className="logo-tile" width="36" height="36" rx="9" />
      {/* 뒤쪽 보조 공 */}
      <circle cx="25" cy="12" r="6.5" fill="#fff" opacity="0.5" />
      {/* 메인 로또 공 */}
      <circle cx="15.5" cy="20.5" r="9.5" fill="#fff" />
      <circle cx="12" cy="17" r="2.6" fill="#fff" opacity="0.65" />
      <text className="logo-num" x="15.5" y="21.2" textAnchor="middle" dominantBaseline="central">6</text>
    </svg>
  );
}

function Ball({ n, i = 0, animate }: { n: number; i?: number; animate?: boolean }) {
  return (
    <span className={`ball ${ballClass(n)}`} style={animate ? { animationDelay: `${i * 65}ms` } : undefined}>
      {n}
    </span>
  );
}

function Balls({ nums, bonus, size, roll }: { nums: number[]; bonus?: number; size?: "lg" | "sm"; roll?: boolean }) {
  return (
    <div className={`balls${size ? ` balls-${size}` : ""}${roll ? " balls-roll" : ""}`}>
      {nums.map((n, i) => <Ball key={n} n={n} i={i} animate={roll} />)}
      {bonus !== undefined && (
        <>
          <span className="plus">+</span>
          <Ball n={bonus} i={nums.length} animate={roll} />
        </>
      )}
    </div>
  );
}

export default function App() {
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RecommendMode>("frequency");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [saved, setSaved] = useState<number[][]>(() => {
    try { return JSON.parse(localStorage.getItem("savedCombos") ?? "[]"); } catch { return []; }
  });
  const [copied, setCopied] = useState(false);
  const [rollId, setRollId] = useState(0); // 추천할 때마다 공 애니메이션 재생용
  const [range, setRange] = useState<{ start: number; end: number } | null>(null); // 회차 범위 필터
  const [gapView, setGapView] = useState<5 | 10>(10); // 미출현 기간 버킷 (기본 10회)
  const [pipe, setPipe] = useState<PipelineResult | null>(null); // 9단계 파이프라인 결과
  const [pipeRoll, setPipeRoll] = useState(0); // 고급 추천 공 애니메이션 재생용
  const [excluded, setExcluded] = useState<number[]>([]); // 제외 숫자 (최대 6)
  const [exInput, setExInput] = useState("");
  const [back, setBack] = useState<BacktestResult | null>(null); // 백테스트 결과
  const [backRunning, setBackRunning] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    fetch("/lotto.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("lotto.json 없음"))))
      .then((data: Draw[]) => {
        setDraws(data);
        const nos = data.map((d) => d.drwNo);
        const max = Math.max(...nos);
        const min = Math.min(...nos);
        // 기본값: 끝=최신 회차, 시작=끝-9 (최근 10회차)
        setRange({ start: Math.max(min, max - 9), end: max });
      })
      .catch((e) => setError(e.message));
  }, []);

  // 선택 가능한 회차 목록 (오름차순)
  const allNos = useMemo(
    () => (draws ? [...draws.map((d) => d.drwNo)].sort((a, b) => a - b) : []),
    [draws]
  );

  // 범위 필터 적용된 회차들
  const filtered = useMemo(() => {
    if (!draws) return [];
    if (!range) return draws;
    const lo = Math.min(range.start, range.end);
    const hi = Math.max(range.start, range.end);
    return draws.filter((d) => d.drwNo >= lo && d.drwNo <= hi);
  }, [draws, range]);

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const f = frequency(filtered);
    const g = gaps(filtered);
    return {
      total: filtered.length,
      latest: latest(filtered),
      recent: [...filtered].sort((a, b) => b.drwNo - a.drwNo).slice(0, 10),
      freqData: NUMS.map((n) => ({ n, count: f[n] })),
      // 미출현 기간 버킷: 5~9회 / 10회 이상 (각각 미출현 기간 내림차순, 마지막 출현 회차 포함)
      ...(() => {
        const lastSeen: Record<number, number> = {};
        for (const d of filtered) for (const n of d.numbers) if (!lastSeen[n] || d.drwNo > lastSeen[n]) lastSeen[n] = d.drwNo;
        const items = NUMS.map((n) => ({ n, gap: g[n], last: lastSeen[n] ?? null }));
        return {
          gapMid: items.filter((x) => x.gap >= 5 && x.gap <= 9).sort((a, b) => b.gap - a.gap),
          gapHigh: items.filter((x) => x.gap >= 10).sort((a, b) => b.gap - a.gap),
        };
      })(),
      pat: patterns(filtered),
      consec: consecutive(filtered),
      hotCold: hotColdByDraw(draws ?? filtered, [...filtered].sort((a, b) => b.drwNo - a.drwNo).slice(0, 40), 10),
      flow: moduleA(filtered),
      dist: moduleD(filtered),
      matrix: moduleF(filtered),
      tail: moduleE(filtered),
      cluster: moduleH(filtered),
      influence: moduleB(filtered),
    };
  }, [filtered]);

  if (error)
    return (
      <div className="content">
        <div className="group span-2">
          <div className="group-card pad" style={{ textAlign: "center" }}>
            <p className="empty">데이터를 불러오지 못했어요.<br />네트워크 상태를 확인하고 다시 시도해 주세요.</p>
            <button className="btn-filled" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>다시 시도</button>
          </div>
        </div>
      </div>
    );
  if (!stats) return <div className="content"><p className="empty">불러오는 중…</p></div>;

  const onRecommend = () => { setRec(recommend(filtered, mode, excluded)); setCopied(false); setRollId((v) => v + 1); };
  const onRunPipeline = () => { setPipe(runPipeline(filtered, excluded)); setPipeRoll((v) => v + 1); };

  // 제외 숫자 추가/삭제 (변경 시 기존 추천 결과는 초기화해 혼동 방지)
  const addExclude = () => {
    const n = parseInt(exInput, 10);
    if (!Number.isInteger(n) || n < 1 || n > 45 || excluded.includes(n) || excluded.length >= 6) return;
    setExcluded([...excluded, n].sort((a, b) => a - b));
    setExInput("");
    setRec(null);
    setPipe(null);
  };
  const removeExclude = (n: number) => { setExcluded(excluded.filter((x) => x !== n)); setRec(null); setPipe(null); };
  const clearExclude = () => { setExcluded([]); setRec(null); setPipe(null); };
  const onBacktest = () => {
    // 백테스트는 전체 회차 기준(과거 시점마다 직전까지 데이터 사용) — 범위 필터와 무관
    setBackRunning(true);
    setTimeout(() => {
      setBack(runBacktest(draws!, 50));
      setBackRunning(false);
    }, 30);
  };
  const onCopy = () => { if (rec) { navigator.clipboard?.writeText(rec.numbers.join(", ")); setCopied(true); } };
  const onSave = () => {
    if (!rec) return;
    const next = [rec.numbers, ...saved].slice(0, 10);
    setSaved(next);
    localStorage.setItem("savedCombos", JSON.stringify(next));
  };
  const onClearSaved = () => { setSaved([]); localStorage.removeItem("savedCombos"); };

  return (
    <div className="app">
      {qrOpen && <QrScanner onClose={() => setQrOpen(false)} />}
      <button className="qr-fab" onClick={() => setQrOpen(true)} aria-label="복권 QR 당첨확인">📷</button>
      <header className="nav">
        <div className="brand">
          <Logo />
          <div className="brand-titles">
            <h1 className="large-title">호매실양사장's 로또 연구소</h1>
          </div>
        </div>
        <p className="nav-sub">
          {stats.total === draws!.length
            ? `전체 ${draws!.length}회차 분석`
            : `${range!.start}–${range!.end}회 · ${stats.total}회차 분석`}
        </p>
        {range && (
          <div className="filter">
            <span className="filter-label">회차 범위</span>
            <div className="select-wrap">
              <select
                aria-label="시작 회차"
                value={range.start}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRange((r) => ({ start: v, end: Math.max(v, r!.end) }));
                }}
              >
                {allNos.map((n) => <option key={n} value={n}>{n}회</option>)}
              </select>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M6 8.5 1.5 4l1-1L6 6.5 9.5 3l1 1z" /></svg>
            </div>
            <span className="filter-sep">–</span>
            <div className="select-wrap">
              <select
                aria-label="종료 회차"
                value={range.end}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRange((r) => ({ end: v, start: Math.min(v, r!.start) }));
                }}
              >
                {allNos.map((n) => <option key={n} value={n}>{n}회</option>)}
              </select>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path fill="currentColor" d="M6 8.5 1.5 4l1-1L6 6.5 9.5 3l1 1z" /></svg>
            </div>
            {(() => {
              const first = allNos[0];
              const last = allNos[allNos.length - 1];
              const setLastN = (n: number) => setRange({ start: Math.max(first, last - (n - 1)), end: last });
              const isAll = range.start === first && range.end === last;
              const is10 = range.end === last && range.start === Math.max(first, last - 9);
              const is5 = range.end === last && range.start === Math.max(first, last - 4);
              return (
                <div className="filter-quick-group">
                  <button className={`filter-quick${isAll ? " active" : ""}`} onClick={() => setRange({ start: first, end: last })}>전체</button>
                  <button className={`filter-quick${is10 ? " active" : ""}`} onClick={() => setLastN(10)}>10회차</button>
                  <button className={`filter-quick${is5 ? " active" : ""}`} onClick={() => setLastN(5)}>5회차</button>
                </div>
              );
            })()}
          </div>
        )}
      </header>

      <main className="content">
        {/* F1 최신 당첨번호 */}
        <section className="group span-2">
          <div className="group-header">최신 당첨번호</div>
          <div className="group-card pad hero-card">
            <div className="card-meta">{stats.latest.drwNo}회 · {stats.latest.drwNoDate}</div>
            <Balls nums={stats.latest.numbers} bonus={stats.latest.bonus} size="lg" />
          </div>
        </section>

        {/* 최근 10회차 */}
        <section className="group span-2">
          <div className="group-header">최근 10회차</div>
          <div className="group-card list">
            {stats.recent.map((d) => (
              <div key={d.drwNo} className="row">
                <div className="row-lead">
                  <span className="row-title">{d.drwNo}회</span>
                  <span className="row-sub">{d.drwNoDate}</span>
                </div>
                <Balls nums={d.numbers} bonus={d.bonus} size="sm" />
              </div>
            ))}
          </div>
        </section>

        {/* ── 방법론 분석 모듈 ── */}
        {/* 모듈 A: 구간 흐름 */}
        <section className="group">
          <div className="group-header"><span>구간 흐름</span><span className="hd-tag">모듈 A</span></div>
          <div className="group-card list">
            {stats.flow.map((f) => (
              <div key={f.key} className="row">
                <div className="row-lead">
                  <span className="row-title">{f.label} <span className="row-sub">{f.range}</span></span>
                  <span className="row-sub">최근5 {f.shortAvg.toFixed(1)} · 장기 {f.longAvg.toFixed(1)}</span>
                </div>
                <span className={`state-badge ${FLOW_CLASS[f.state]}`}>{f.state}</span>
              </div>
            ))}
          </div>
          <p className="group-foot">단기(5회) vs 장기(20회) 구간 출현 흐름</p>
        </section>

        {/* 모듈 D: 분산 안정성 */}
        <section className="group">
          <div className="group-header"><span>분산 안정성</span><span className="hd-tag">모듈 D</span></div>
          <div className="group-card pad">
            <div className="dist-grade">
              <span className={`grade-badge g-${stats.dist.grade === "양호" ? "good" : stats.dist.grade === "보통" ? "mid" : "bad"}`}>{stats.dist.grade}</span>
              <span className="row-sub">기대 대비 편차 {stats.dist.deviation.toFixed(1)}%p</span>
            </div>
            {([["저 (1–20)", "low"], ["중 (21–40)", "mid"], ["고 (41–45)", "high"]] as const).map(([lab, k]) => (
              <div key={k} className="dist-row">
                <span className="dist-label">{lab}</span>
                <div className="barTrack"><div className="barFill" style={{ width: `${stats.dist.act[k]}%` }} /></div>
                <span className="dist-val">{stats.dist.act[k].toFixed(0)}%<span className="dist-exp"> / {stats.dist.exp[k].toFixed(0)}%</span></span>
              </div>
            ))}
          </div>
          <p className="group-foot">실제 비율 / 기대 비율(번호 개수 비례)</p>
        </section>

        {/* 모듈 F: 이전 출현 히트맵 */}
        <section className="group span-2">
          <div className="group-header"><span>이전 출현 히트맵</span><span className="hd-tag">모듈 F · 최근 {stats.matrix.window}회</span></div>
          <div className="group-card pad">
            <div className="heatgrid">
              {stats.matrix.cells.map((c) => {
                const t = c.count / stats.matrix.maxCount;
                return (
                  <div
                    key={c.n}
                    className="heatcell"
                    style={{
                      background: c.count === 0 ? "var(--fill)" : `rgba(255,55,95,${(0.16 + 0.84 * t).toFixed(3)})`,
                      color: t > 0.5 ? "#fff" : "var(--label)",
                    }}
                    title={`${c.n}번 · 출현 ${c.count}회 · 현재 미출현 ${c.gap}회`}
                  >
                    {c.n}
                  </div>
                );
              })}
            </div>
            <div className="heat-report">
              <div><span className="row-sub">공백(미출현):</span> {stats.matrix.blanks.length ? stats.matrix.blanks.map((b) => b.n).join(", ") : "없음"}</div>
              <div><span className="row-sub">밀집(과열):</span> {stats.matrix.dense.filter((d) => d.count > 0).map((d) => `${d.n}(${d.count})`).join(", ") || "없음"}</div>
            </div>
          </div>
          <p className="group-foot">진할수록 최근 자주 출현 · 칸에 마우스를 올리면 상세</p>
        </section>

        {/* 모듈 B: 영향력 지수 */}
        <section className="group">
          <div className="group-header"><span>영향력 지수</span><span className="hd-tag">모듈 B</span></div>
          <div className="group-card pad">
            {stats.influence.map((r) => (
              <div key={r.key} className="dist-row">
                <span className="dist-label">{r.label} <span className="row-sub">{r.range}</span></span>
                <div className="barTrack"><div className="barFill" style={{ width: `${r.score}%` }} /></div>
                <span className="infl-val">
                  {r.score}
                  {r.flag && <span className={`infl-flag ${r.flag === "과열" ? "fl-hot" : "fl-under"}`}>{r.flag}</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="group-foot">빈도 × 연속출현 × 안정성 → 0~100 점수</p>
        </section>

        {/* 모듈 H: 인접 클러스터 */}
        <section className="group">
          <div className="group-header"><span>인접 클러스터</span><span className="hd-tag">모듈 H</span></div>
          <div className="group-card pad">
            {stats.cluster.top.length ? (
              <div className="cluster-list">
                {stats.cluster.top.map((c) => (
                  <div key={c.n} className="cluster-item">
                    <Ball n={c.n} />
                    <span className="cluster-score">강도 {c.score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">동반 출현 데이터 부족</p>
            )}
          </div>
          <p className="group-foot">±1~3 이웃이 자주 동반 출현하는 중심 번호</p>
        </section>

        {/* F2 출현 빈도 */}
        <section className="group">
          <div className="group-header">번호별 출현 빈도</div>
          <div className="group-card pad">
            <Suspense fallback={<p className="empty">차트 로딩 중…</p>}>
              <FreqChart data={stats.freqData} />
            </Suspense>
          </div>
        </section>

        {/* F4 패턴 분포 */}
        <section className="group">
          <div className="group-header">패턴 분포</div>
          <div className="group-card list">
            <div className="row"><span className="row-title">홀 : 짝</span><span className="row-value">{stats.pat.oddPct}% : {100 - stats.pat.oddPct}%</span></div>
            <div className="row"><span className="row-title">저(1–22) : 고(23–45)</span><span className="row-value">{stats.pat.lowPct}% : {100 - stats.pat.lowPct}%</span></div>
            <div className="row"><span className="row-title">구간 합계</span><span className="row-value">{stats.pat.bins.join(" / ")}</span></div>
          </div>
        </section>

        {/* 출현/미출현수 현황 (최근 10회 핫/콜드) */}
        <section className="group span-2">
          <div className="group-header"><span>출현/미출현수 현황</span><span className="hd-tag">직전 10회 기준</span></div>
          <div className="group-card list">
            <div className="row hc-head">
              <span className="row-title">회차</span>
              <span className="hc-legend"><span className="hc-dot hot" />출현 <span className="hc-dot cold" />미출현</span>
            </div>
            {stats.hotCold.map((h) => (
              <div key={h.drwNo} className="row hc-row">
                <div className="row-lead">
                  <span className="row-title">{h.drwNo}회</span>
                  <span className="row-sub">{h.drwNoDate}</span>
                </div>
                <div className="hc-bar" title={`출현 ${h.hot} / 미출현 ${h.cold}`}>
                  {h.hot > 0 && <span className="hc-seg hc-hot" style={{ flex: h.hot }}>{h.hot}</span>}
                  {h.cold > 0 && <span className="hc-seg hc-cold" style={{ flex: h.cold }}>{h.cold}</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="group-foot">각 회차 당첨번호 6개 중 직전 10회에 나온 적 있는 수(출현) / 없던 수(미출현)</p>
        </section>

        {/* F3 미출현 기간 — 5회/10회 버튼 토글 (기본 10회) */}
        <section className="group span-2">
          <div className="group-header">
            <span>미출현 기간</span>
            <div className="seg-mini" role="tablist">
              <button role="tab" aria-selected={gapView === 5} className={gapView === 5 ? "segm active" : "segm"} onClick={() => setGapView(5)}>5회</button>
              <button role="tab" aria-selected={gapView === 10} className={gapView === 10 ? "segm active" : "segm"} onClick={() => setGapView(10)}>10회</button>
            </div>
          </div>
          <div className="group-card pad gaps-card">
            {(() => {
              const list = gapView === 5 ? stats.gapMid : stats.gapHigh;
              return list.length ? (
                <div className="gaps">
                  {list.map((g) => (
                    <div
                      key={g.n}
                      className="gapItem tip"
                      tabIndex={0}
                      data-tip={g.last ? `마지막 출현 ${g.last}회` : "범위 내 미출현"}
                    >
                      <Ball n={g.n} />
                      <span className="gap-count">{g.gap}회</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">{gapView === 5 ? "5–9회" : "10회 이상"} 미출현 번호 없음</p>
              );
            })()}
          </div>
          <p className="group-foot">{gapView === 5 ? "5~9회 동안 안 나온 번호" : "10회 이상 안 나온 번호"}</p>
        </section>

        {/* F8 연속번호 */}
        <section className="group">
          <div className="group-header">연속번호 분석</div>
          <div className="group-card pad">
            <p className="card-meta">연속된 번호 쌍이 1개 이상 나온 회차 {stats.consec.withConsecPct}%</p>
            <div className="bars">
              {Object.entries(stats.consec.dist)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([pairs, cnt]) => (
                  <div key={pairs} className="barRow">
                    <span className="bar-label">{pairs}쌍</span>
                    <div className="barTrack"><div className="barFill" style={{ width: `${(cnt / stats.total) * 100}%` }} /></div>
                    <span className="bar-value">{cnt}회</span>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* 모듈 E: 끝수 패턴 */}
        <section className="group">
          <div className="group-header"><span>끝수 패턴</span><span className="hd-tag">모듈 E</span></div>
          <div className="group-card pad">
            {stats.tail.active.length > 0 && (
              <div className="active-tails">
                <span className="row-sub">현재 주목 끝수 (최근 {stats.tail.window}회):</span>
                <span className="tail-chips">
                  {stats.tail.active.map((d) => <span key={d} className="tail-chip">{d}계열</span>)}
                </span>
              </div>
            )}
            <div className="bars">
              {(() => {
                const max = Math.max(...stats.tail.freq.map((d) => d.count), 1);
                return stats.tail.freq.map((d) => (
                  <div key={d.digit} className="barRow">
                    <span className="bar-label">…{d.digit}</span>
                    <div className="barTrack"><div className="barFill" style={{ width: `${(d.count / max) * 100}%` }} /></div>
                    <span className="bar-value">{d.count}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
          <p className="group-foot">끝수 계열 출현 빈도 + 최근 집중 계열</p>
        </section>

        {/* 제외 숫자 (수동입력) */}
        <section className="group span-2">
          <div className="group-header"><span>제외숫자 (수동입력)</span><span className="hd-tag">최대 6개</span></div>
          <div className="group-card pad">
            <div className="exclude-input">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={45}
                placeholder="1–45"
                value={exInput}
                onChange={(e) => setExInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addExclude(); }}
              />
              <button className="btn-tinted" onClick={addExclude} disabled={excluded.length >= 6}>추가</button>
              {excluded.length > 0 && <button className="btn-tinted" onClick={clearExclude}>초기화</button>}
            </div>
            {excluded.length > 0 ? (
              <div className="exclude-balls">
                {excluded.map((n) => (
                  <button key={n} className="ex-ball" onClick={() => removeExclude(n)} aria-label={`${n} 제외 해제`}>
                    <Ball n={n} />
                    <span className="ex-ball-x">✕</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty">제외할 번호를 입력하면 아래 번호 추천·고급 추천 결과에서 빠집니다</p>
            )}
          </div>
        </section>

        {/* F5 번호 추천 */}
        <section className="group span-2">
          <div className="group-header">번호 추천</div>
          <div className="group-card pad">
            <div className="segmented" role="tablist">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={m.key === mode}
                  className={m.key === mode ? "seg active" : "seg"}
                  onClick={() => setMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="rec-result">
              {rec ? <Balls key={rollId} nums={rec.numbers} size="lg" roll /> : <span className="empty">모드를 고르고 번호를 추천받아 보세요</span>}
            </div>
            {rec && <p className="rec-reason">{rec.reason}<br /><span className="disclaimer">통계적 재미일 뿐 당첨을 보장하지 않습니다.</span></p>}
            <button className="btn-filled" onClick={onRecommend}>{rec ? "다시 추천" : "추천 받기"}</button>
            {rec && (
              <div className="rec-actions">
                <button className="btn-tinted" onClick={onCopy}>{copied ? "복사됨" : "복사"}</button>
                <button className="btn-tinted" onClick={onSave}>저장</button>
              </div>
            )}
          </div>
        </section>

        {/* 고급 추천 — 9단계 파이프라인 */}
        <section className="group span-2">
          <div className="group-header"><span>🔬 고급 추천</span><span className="hd-tag">9단계 파이프라인</span></div>
          <div className="group-card pad">
            <button className="btn-filled" onClick={onRunPipeline}>{pipe ? "다시 분석" : "9단계 분석 실행"}</button>
            {pipe && (
              <>
                <p className="pipe-note">후보 풀 {pipe.poolSize}개 · {pipe.notes.join(" / ")}</p>
                <div className="pipe-list">
                  {pipe.combos.map((c, i) => (
                    <div key={i} className="pipe-combo">
                      <div className="pipe-rank">#{i + 1}</div>
                      <div className="pipe-mid">
                        <Balls key={`${pipeRoll}-${i}`} nums={c.numbers} size="sm" roll />
                        <div className="pipe-report">
                          저{c.report.low}·중{c.report.mid}·고{c.report.high} · 영향력 {c.report.avgInfluence}
                          {c.report.axisIncluded && " · 중심축✓"}
                          {c.report.flowStrong > 0 && ` · 강세 ${c.report.flowStrong}`}
                        </div>
                      </div>
                      <div className="pipe-score">{c.score}<span className="pipe-score-unit">점</span></div>
                    </div>
                  ))}
                </div>
                <p className="group-foot">A 흐름 → B 영향력 → E 끝수 → F 매트릭스 → G·H 클러스터 → C 중심축 → D 분산 순 필터·가중 · 당첨 보장 아님</p>
              </>
            )}
          </div>
        </section>

        {/* 백테스트 */}
        <section className="group span-2">
          <div className="group-header"><span>백테스트</span><span className="hd-tag">최근 50회 검증</span></div>
          <div className="group-card pad">
            <button className="btn-filled" onClick={onBacktest} disabled={backRunning}>
              {backRunning ? "분석 중…" : back ? "다시 검증" : "백테스트 실행"}
            </button>
            {back && (
              <>
                <div className="bt-metrics">
                  <div className="bt-metric">
                    <span className="bt-num">{back.avgMatch.toFixed(2)}</span>
                    <span className="bt-label">파이프라인 평균 적중</span>
                  </div>
                  <div className="bt-metric">
                    <span className="bt-num">{back.randomSimAvg.toFixed(2)}</span>
                    <span className="bt-label">랜덤 {back.randomSims.toLocaleString()}회 평균</span>
                  </div>
                  <div className="bt-metric">
                    <span className="bt-num">{back.best ? `${back.best.matchCount}개` : "-"}</span>
                    <span className="bt-label">최고 적중 ({back.best ? `${back.best.drwNo}회` : "-"})</span>
                  </div>
                </div>
                <div className="bt-ranks">
                  {Object.entries(back.rankDist).map(([rank, cnt]) => (
                    <span key={rank} className={`bt-rank${cnt > 0 && rank !== "꽝" ? " hit" : ""}`}>{rank} {cnt}</span>
                  ))}
                </div>
                <p className="group-foot">
                  {back.n}개 회차 검증 · 랜덤 {back.randomSims.toLocaleString()}회 시뮬 평균 {back.randomSimAvg.toFixed(2)}개 대비{" "}
                  {back.avgMatch <= back.randomSimAvg + 0.1
                    ? "파이프라인이 유의미한 우위를 보이지 않습니다 (로또는 독립 시행)."
                    : "이번 표본에선 약간 높지만 통계적 우연일 가능성이 큽니다."}
                </p>
              </>
            )}
          </div>
        </section>

        {/* 저장한 조합 */}
        {saved.length > 0 && (
          <section className="group span-2">
            <div className="group-header">
              <span>저장한 조합 ({saved.length})</span>
              <button className="header-action" onClick={onClearSaved}>전체 삭제</button>
            </div>
            <div className="group-card list">
              {saved.map((combo, i) => (
                <div key={i} className="row"><Balls nums={combo} size="sm" /></div>
              ))}
            </div>
          </section>
        )}

        <p className="footer span-2">과거 데이터 분석이며 로또는 독립 시행이라 당첨을 보장하지 않습니다.</p>
        <p className="copyright span-2">© 2026 호매실양사장's 로또 연구소. All rights reserved.</p>
      </main>
    </div>
  );
}
