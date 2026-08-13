import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  Download,
  Home,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Heart,
} from "lucide-react";
import { toPng } from "html-to-image";
import { recentWindow, type MarketFlow, type ProgramPoint } from "./domain";
import { flowConfidence, flowShift, flowSync, summary } from "./engine";
import "./chart.css";
import "./ai.css";
import "./briefing.css";
import "./briefing-v2.css";
import "./briefing-v3.css";
import "./briefing-v4.css";
import StockAnalysis from "./StockAnalysis";
import Watchlist from "./Watchlist";
import type { SearchableStock } from "./StockAnalysis";
import type { EndedObservation, EntryRecord, Observation } from "./Watchlist";
import { apiUrl } from "./api";

type Tab = "Flow" | "AI" | "Watch" | "Feed" | "Me";
type Market = "KOSPI" | "KOSDAQ" | "NASDAQ";
const colors = {
  foreign: "#20a589",
  personal: "#61a5e8",
  institution: "#c94b8c",
  program: "#df8518",
};
const formatEok = (value: number, showPlus = true) =>
  `${showPlus && value > 0 ? "+" : ""}${(value / 100).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
function useMarkets() {
  const [markets, setMarkets] = useState<Partial<Record<Market, MarketFlow>>>(
      {},
    ),
    [loading, setLoading] = useState<Record<Market, boolean>>({
      KOSPI: true,
      KOSDAQ: true,
      NASDAQ: true,
    });
  useEffect(() => {
    let cancelled = false;
    const fetchOne = async (value: Market) => {
        try {
          const response = await fetch(apiUrl(`/api/market/flow?market=${value}`)), body = await response.json();
          if (!cancelled && response.ok && body.live && body.market === value) {
            setMarkets((current) => ({ ...current, [value]: body }));
            setLoading((current) => ({ ...current, [value]: false }));
          }
        } catch {}
      }, load=()=>Promise.all((["KOSPI","NASDAQ","KOSDAQ"] as Market[]).map(fetchOne));
    load();
    const timer=setInterval(load,15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  return {
    markets,
    loading,
    load: () => location.reload(),
  };
}
function useCandidates() {
  const [data,setData] = useState<{stocks:SearchableStock[];universeCount:number;priceCount:number;calculatedAt?:string}>({stocks:[],universeCount:0,priceCount:0});
  useEffect(()=>{let cancelled=false;const load=async()=>{try{const response=await fetch(apiUrl("/api/candidates")),body=await response.json();if(!cancelled&&response.ok&&body.live)setData(body);}catch{}};load();const timer=setInterval(load,60000);return()=>{cancelled=true;clearInterval(timer)}},[]);
  return data;
}

function IndexChart({ indices = [] }: { indices?: MarketFlow["indices"] }) {
  const width = 600, height = 270, left = 44, right = 18, top = 20, bottom = 40,
    palette = [colors.personal, colors.foreign, "#ff9f43"],
    sessionPoint = (point: ProgramPoint) => { const [h,m] = point.time.split(":").map(Number); return h * 60 + m >= 570 && h * 60 + m <= 960; },
    series = indices.map((index, i) => {
      const points = [...index.points].filter((point) => point.value > 0 && sessionPoint(point)).sort((a,b) => a.time.localeCompare(b.time)).filter((p,n,all) => all.findIndex((v)=>v.time===p.time)===n),
        base = points[0]?.value || index.price || 1;
      return { ...index, points, color: palette[i], values: points.map((p) => (p.value / base - 1) * 100) };
    }),
    all = series.flatMap((s) => s.values), scale = Math.max(0.1, ...all.map(Math.abs)),
    startMinutes = 9 * 60 + 30,
    pointMinutes = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; },
    latestMinutes = Math.max(startMinutes + 30, ...series.flatMap((s) => s.points.map((p) => pointMinutes(p.time)))),
    endMinutes = Math.min(16 * 60, latestMinutes),
    x = (time: string) => left + (Math.max(startMinutes, Math.min(endMinutes, pointMinutes(time))) - startMinutes) * (width - left - right) / (endMinutes - startMinutes),
    y = (v: number) => top + (scale - v) * (height - top - bottom) / (scale * 2),
    path = (values: number[], points: ProgramPoint[]) => values.map((v, i) => `${i ? "L" : "M"}${x(points[i].time)},${y(v)}`).join(" "),
    ticks = Array.from({length: Math.floor((endMinutes - startMinutes) / 30) + 1}, (_, i) => startMinutes + i * 30),
    label = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`;
  return <div className="chart index-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="나스닥 S&P 500 다우지수 장중 등락률">
      {ticks.map((minute, i) => <g key={minute}><line x1={x(label(minute))} x2={x(label(minute))} y1={top} y2={height-bottom} stroke="#1d2940"/>{i % 2 === 0 && <text x={x(label(minute))} y={height-18} textAnchor={i === 0 ? "start" : "middle"} fill="#71809b" fontSize="9">{label(minute)}</text>}</g>)}
      {[-1, 0, 1].map((n) => <g key={n}><line x1={left} x2={width-right} y1={y(n*scale)} y2={y(n*scale)} stroke="#33405a" strokeDasharray="4 5"/><text x={left-6} y={y(n*scale)+4} textAnchor="end" fill="#71809b" fontSize="10">{(n*scale).toFixed(1)}%</text></g>)}
      {series.map((s) => <path key={s.code} d={path(s.values, s.points)} stroke={s.color}/>) }
      <text x={width/2} y={height-3} textAnchor="middle" fill="#71809b" fontSize="10">미국 본장 09:30–16:00 · 5분봉 · 개장 대비 누적 등락률</text>
    </svg>
    <div className="legend flow-legend">{series.map((s) => <span key={s.code} style={{color:s.color}}>● {s.name}</span>)}</div>
  </div>;
}

function Chart({
  investors,
  program,
  investorAvailable = true,
}: {
  investors: MarketFlow["investorPoints"];
  program: ProgramPoint[];
  investorAvailable?: boolean;
}) {
  const w = 600,
    h = 300,
    left = 58,
    right = 58,
    top = 22,
    bottom = 42,
    now = new Date(),
    startMinutes = 8 * 60,
    currentMinutes = now.getHours() < 8 ? 20 * 60 : Math.min(20 * 60, now.getHours() * 60 + now.getMinutes()),
    endMinutes = Math.max(startMinutes + 30, currentMinutes),
    pointMinutes = (value: string) => {
      if (value.includes("T")) {
        const date = new Date(value);
        return date.getHours() * 60 + date.getMinutes();
      }
      const [hour, minute] = value.split(":").map(Number);
      return Number.isFinite(hour + minute) ? hour * 60 + minute : endMinutes;
    },
    x = (value: string) =>
      left +
      ((Math.max(startMinutes, pointMinutes(value)) - startMinutes) *
        (w - left - right)) /
        (endMinutes - startMinutes),
    time = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    xTicks = Array.from(
      { length: Math.floor((endMinutes - startMinutes) / 30) + 1 },
      (_, index) => startMinutes + index * 30,
    ),
    sortedInvestors = [...(investors ?? [])].sort((a,b) => pointMinutes(a.time) - pointMinutes(b.time)),
    sortedProgram = [...program].sort((a,b) => pointMinutes(a.time) - pointMinutes(b.time)).filter((point,index,all) => all.findIndex((item)=>pointMinutes(item.time)===pointMinutes(point.time))===index),
    series = [
      {
        name: "외국인",
        color: colors.foreign,
        points: sortedInvestors,
        values: sortedInvestors.map((p) => p.foreign),
      },
      {
        name: "개인",
        color: colors.personal,
        points: sortedInvestors,
        values: sortedInvestors.map((p) => p.personal),
      },
      {
        name: "기관",
        color: colors.institution,
        points: sortedInvestors,
        values: sortedInvestors.map((p) => p.institution),
      },
      {
        name: "프로그램",
        color: colors.program,
        points: sortedProgram,
        values: sortedProgram.map((p) => p.value),
      },
    ].filter((item)=>investorAvailable||item.name==="프로그램"),
    investorScale = Math.max(
      1,
      ...sortedInvestors.flatMap((point) => [point.foreign,point.personal,point.institution].map(Math.abs)),
    ),
    programScale = Math.max(1, ...sortedProgram.map((point)=>Math.abs(point.value))),
    y = (value: number, scale: number) =>
      top + ((scale - value) / (scale * 2)) * (h - top - bottom),
    path = (values: number[], points: { time: string }[], scale: number) =>
      values
        .map(
          (value, index) =>
            `${index ? "L" : "M"}${x(points[index].time)},${y(value, scale)}`,
        )
        .join(" "),
    signed = (value: number) => formatEok(value);
  return (
    <div className="chart">
      <div className="axis-unit">
        장중 누적 순매수 · 좌측 투자자 / 우측 프로그램 (억원)
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="08시부터 외국인 개인 기관 프로그램 순매수 거래대금 변화"
      >
        {xTicks.map((value, index) => (
          <g key={value}>
            <line
              x1={x(time(value))}
              x2={x(time(value))}
              y1={top}
              y2={h - bottom}
              stroke="#1d2940"
            />
            {index % 4 === 0 && (
              <text
                x={x(time(value))}
                y={h - 14}
                textAnchor={index === 0 ? "start" : "middle"}
                fill="#71809b"
                fontSize="10"
              >
                {time(value)}
              </text>
            )}
          </g>
        ))}
        {[-1, 0, 1].map((position) => (
          <g key={position}>
            <line
              x1={left}
              x2={w - right}
              y1={y(position * investorScale, investorScale)}
              y2={y(position * investorScale, investorScale)}
              stroke="#33405a"
              strokeDasharray="4 5"
            />
            <text
              x={left - 7}
              y={y(position * investorScale, investorScale) + 4}
              textAnchor="end"
              fill="#71809b"
              fontSize="10"
            >
              {signed(position * investorScale)}
            </text>
            <text
              x={w - right + 7}
              y={y(position * programScale, programScale) + 4}
              fill="#a87a49"
              fontSize="10"
            >
              {signed(position * programScale)}
            </text>
          </g>
        ))}
        {series.map((item, index) => {
          const scale = item.name === "프로그램" ? programScale : investorScale;
          return (
            <g key={item.name}>
              <path
                d={path(item.values, item.points, scale)}
                stroke={item.color}
              />
            </g>
          );
        })}
      </svg>
      <div className="axis-caption">X축 · 거래 시각 (08:00부터 · 30분 간격)</div>
      <div className="legend flow-legend">
        {series.map((item, index) => (
          <span key={item.name} style={{ color: item.color }}>
            ●{" "}
            {item.name}
          </span>
        ))}
      </div>
      {!investorAvailable && (
        <small className="collecting">
          개인·외국인·기관은 NXT에서 미제공되며 KRX 집계 시작 후 자동 표시됩니다.
        </small>
      )}
    </div>
  );
}

function Connection({ message, load }: { message?: string; load: () => void }) {
  return (
    <section className="hero disconnected">
      <small>LIVE DATA · 연결되지 않음</small>
      <h1>
        FlowPulse 실제 시장 데이터
        <br />
        연결이 필요합니다.
      </h1>
      <p>
        {message ??
          "KIS 앱 키를 서버에 설정하면 실제 투자자별·프로그램 매매 데이터가 표시됩니다."}
      </p>
      <button onClick={load}>
        <RefreshCw size={14} /> 다시 확인
      </button>
    </section>
  );
}

function Flow({
  markets,
  loading,
  load,
}: {
  markets: Partial<Record<Market, MarketFlow>>;
  loading: Record<Market, boolean>;
  load: () => void;
}) {
  const [market, setMarket] = useState<Market>("KOSPI"),
    data = markets[market],
    snapshot = data?.snapshot,
    programPoints = data?.programPoints ?? [],
    latest = snapshot ? { time: data?.asOf ?? "", ...snapshot } : null,
    insight = latest ? summary(latest) : null,
    asOf = data?.asOf ? new Date(data.asOf).toLocaleTimeString("ko-KR") : null,
    firstInvestor = [...(data?.investorPoints ?? [])]
      .reverse()
      .find((point) => new Date(point.time).getTime() <= new Date(data?.asOf ?? 0).getTime() - 29 * 60000),
    hasThirtyMinutes = Boolean(
      firstInvestor &&
      latest &&
      new Date(latest.time).getTime() -
        new Date(firstInvestor.time).getTime() >=
        29 * 60000,
    ),
    delta = {
      foreign:
        hasThirtyMinutes && firstInvestor && latest
          ? latest.foreign - firstInvestor.foreign
          : null,
      personal:
        hasThirtyMinutes && firstInvestor && latest
          ? latest.personal - firstInvestor.personal
          : null,
      institution:
        hasThirtyMinutes && firstInvestor && latest
          ? latest.institution - firstInvestor.institution
          : null,
      program:
        programPoints.length > 1
          ? programPoints.at(-1)!.value - programPoints[0].value
          : null,
    },
    actors = latest
      ? ([
          ["외국인", latest.foreign, delta.foreign],
          ["개인", latest.personal, delta.personal],
          ["기관", latest.institution, delta.institution],
          ["프로그램", latest.program, delta.program],
        ] as const)
      : [];
  return (
    <>
      <header>
        <b>
          FlowPulse <i>AI</i>
        </b>
        <Search size={20} />
      </header>
      <div className="segments">
        {(["KOSPI", "KOSDAQ"] as Market[]).map((value) => (
          <button
            key={value}
            className={market === value ? "active" : ""}
            onClick={() => setMarket(value)}
          >
            {value === "KOSPI" ? "코스피" : "코스닥"}
          </button>
        ))}
      </div>
      {loading[market] ? (
        <section className="hero">
          <h1>
            FlowPulse {market === "KOSPI" ? "코스피" : "코스닥"} 데이터를
            <br />
            불러오고 있습니다.
          </h1>
        </section>
      ) : !data?.live || !latest ? (
        <Connection message={data?.message} load={load} />
      ) : (
        <>
          <section className="hero">
            <small>
              {market === "KOSPI" ? "코스피" : "코스닥"} 실데이터 · {asOf}
            </small>
            <h1>
              FlowPulse {insight!.label} 수급이
              <br />
              감지되었습니다.
            </h1>
            <p>{insight!.text}</p>
            <Sparkles className="orb" />
          </section>
          <section className="temperature">
            <div>
              <small>수급 온도</small>
              <strong>{insight!.temperature}</strong>{" "}
              <span>{insight!.label}</span>
            </div>
            <div className="meter">
              <i style={{ width: `${insight!.temperature}%` }} />
            </div>
          </section>
          <div className="indices">
            {actors.map(([name, total, recent]) => (
              <article key={name}>
                <small>{name}</small>
                <label>오늘 누적</label>
                <b>
                  {formatEok(total)}
                </b>
                <label>최근 30분</label>
                <b className="recent">
                  {recent === null
                    ? "수집 중"
                    : formatEok(recent)}
                </b>
                <em>
                  {name === "프로그램" ? "통합(KRX+NXT)" : "KRX"} · 순매수
                  거래대금 · 억원
                </em>
              </article>
            ))}
          </div>
          <section className="panel">
            <div className="title">
              <div>
                <small>
                  실시간 시장 데이터 · {asOf}
                </small>
                <h2>
                  FlowPulse {market === "KOSPI" ? "코스피" : "코스닥"} 투자
                  주체별 순매수 흐름
                </h2>
              </div>
              <span>08:00부터</span>
            </div>
            <Chart investors={data.investorPoints} program={programPoints} investorAvailable={data.investorAvailable} />
          </section>
        </>
      )}
    </>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <>
      <header>
        <b>FlowPulse {title}</b>
        <Clock3 size={20} />
      </header>
      <section className="empty">
        <BrainCircuit />
        <h2>FlowPulse 실데이터 연결 후 활성화</h2>
        <p>분석·Replay·수급 스냅샷은 실제 KIS 데이터만 사용합니다.</p>
      </section>
    </>
  );
}

function MarketDashboard({
  markets,
  loading,
}: {
  markets: Partial<Record<Market, MarketFlow>>;
  loading: Record<Market, boolean>;
}) {
  const captureRef = useRef<HTMLDivElement>(null),
    [capturing, setCapturing] = useState(false),
    capture = async () => {
      if (!captureRef.current || capturing) return;
      setCapturing(true);
      captureRef.current.classList.add("exporting");
      try {
        await new Promise(requestAnimationFrame);
        const url = await toPng(captureRef.current, {
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            pixelRatio: 2,
            cacheBust: true,
            filter: (node) => !(node instanceof HTMLElement && node.classList.contains("capture-button")),
          }),
          link = document.createElement("a");
        link.download = `FlowPulse-${market}-${new Date().toISOString().slice(0,10)}.png`;
        link.href = url;
        link.click();
      } finally {
        captureRef.current?.classList.remove("exporting");
        setCapturing(false);
      }
    },
    [market, setMarket] = useState<Market>("KOSPI"),
    data = markets[market],
    snapshot = data?.snapshot,
    investors = data?.investorPoints ?? [],
    program = data?.programPoints ?? [],
    investorWindow = recentWindow(investors, data?.asOf ?? ""),
    programWindow = recentWindow(program, data?.asOf ?? ""),
    lastProgram = program.at(-1),
    programDelta = lastProgram && programWindow.start
      ? lastProgram.value - programWindow.start.value
      : null,
    asOf = data?.asOf
      ? new Date(data.asOf).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--",
    signed = (value: number) => `${formatEok(value)}억원`,
    signedShares = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR")}주`,
    direction = (value: number) =>
      value > 0 ? "순매수" : value < 0 ? "순매도" : "중립",
    recent = (key: "foreign" | "personal" | "institution") =>
      investorWindow.start && snapshot ? snapshot[key] - investorWindow.start[key] : null,
    insight = snapshot ? summary({ time: data?.asOf ?? "", ...snapshot }) : null,
    usIndices = data?.indices ?? [],
    nasdaq = usIndices.find((item) => item.code === "COMP"),
    semiconductor = data?.leaders ?? [],
    usPositive = usIndices.filter((item) => item.changeRate > 0).length,
    usLabel = usPositive >= 2 ? "매수 우위" : usPositive === 1 ? "중립" : "매도 우위",
    usTemperature = Math.round(usIndices.reduce((sum, item) => sum + item.changeRate, 0) / Math.max(1, usIndices.length) * 8 + 50),
    usBrief = nasdaq
      ? `나스닥은 ${nasdaq.changeRate >= 0 ? "상승" : "하락"} 중이며 S&P 500·다우와 ${usPositive === 0 || usPositive === 3 ? "같은 방향" : "엇갈린 흐름"}입니다. 반도체 레버리지 SOXL은 ${semiconductor[0]?.changeRate >= 0 ? "강세" : "약세"}, SanDisk는 ${semiconductor[2]?.changeRate >= 0 ? "강세" : "약세"}입니다.`
      : "미국 지수와 반도체 데이터를 분석하고 있습니다.",
    sync = snapshot ? flowSync({time:data?.asOf ?? "",...snapshot}) : 0,
    confidence = flowConfidence(data?.collection?.stored ?? 0, Boolean(market === "NASDAQ" ? usIndices.length : snapshot)),
    syncLabel = Math.abs(sync) >= 65 ? "강한 동조" : Math.abs(sync) >= 30 ? "약한 동조" : "방향 혼재";
  const actors = snapshot
    ? [
        ["개인", snapshot.personal, recent("personal"), "personal"],
        ["외국인", snapshot.foreign, recent("foreign"), "foreign"],
        ["기관", snapshot.institution, recent("institution"), "institution"],
        ["프로그램", snapshot.program, programDelta, "program"],
      ] as const
    : [],
    samsung = data?.leaders?.find((stock) => stock.name.includes("삼성전자")),
    hynix = data?.leaders?.find((stock) => stock.name.includes("하이닉스")),
    stockInvestorPending = "장중 미제공",
    stockInvestorReady = (stock: NonNullable<MarketFlow["leaders"]>[number] | undefined) => Boolean(stock?.investorAvailable),
    stockPrice = (stock: NonNullable<MarketFlow["leaders"]>[number] | undefined, fallback: string) => stock ? `${stock.price.toLocaleString("ko-KR")}원 · ${stock.changeRate >= 0 ? "+" : ""}${stock.changeRate.toFixed(1)}%` : fallback,
    signalStatus = (stock: typeof samsung) => !stock || stock.program === 0 ? "수집 시작" : stock.program > 0 ? "매수 흐름" : "주의 관찰",
    signalCopy = (stock: typeof samsung) => !stock ? "실데이터를 수집하고 있습니다." : `08:00 이후 프로그램 ${direction(stock.program)} ${formatEok(Math.abs(stock.program),false)}억원 · 외국인 ${stockInvestorReady(stock)?`${direction(stock.foreign)} ${Math.abs(stock.foreign).toLocaleString("ko-KR")}주`:stockInvestorPending}`;
  return (
    <div className="capture-area fp-dashboard" ref={captureRef}>
      <header className="fp-header">
        <div><small>FLOW HOME</small><h1>오늘의 시장 흐름</h1></div>
        <span><b>● 정상 수집</b> · 1분 누적 {data?.collection?.stored ?? 0}개 · {asOf} 기준</span>
        <button className="capture-button" onClick={capture} disabled={capturing} aria-label="화면 저장"><Download/></button>
      </header>
      <div className="segments fp-market-tabs">
        {(["KOSPI", "KOSDAQ", "NASDAQ"] as Market[]).map((value) => (
          <button
            key={value}
            className={market === value ? "active" : ""}
            onClick={() => setMarket(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {loading[market] || (market === "NASDAQ" ? !usIndices.length : !snapshot) ? (
        <section className="ai-loading">
          <Sparkles />
          <h2>FlowPulse 실데이터를 분석하고 있습니다.</h2>
        </section>
      ) : (
        <>
          {market !== "NASDAQ" && (
            <section className="kospi-strip">
              <b>{market}</b><strong>{data?.index ? data.index.price.toLocaleString("ko-KR") : "지수 재연결 중"}</strong>
              {data?.index && <span className={data.index.changeRate >= 0 ? "up" : "down"}>{data.index.changeRate >= 0 ? "▲" : "▼"}{Math.abs(data.index.changeRate).toFixed(2)}%</span>}
              {!!data?.index?.advancing && <small><i>상승 {data.index.advancing}</i> · 하락 {data.index.declining}</small>}
            </section>
          )}
          {market === "NASDAQ" && data?.forex && (
            <section className="kospi-strip forex-strip">
              <b>환율</b>
              <span><small>달러/원</small> {data.forex.usdKrw.toLocaleString("ko-KR", {minimumFractionDigits:2, maximumFractionDigits:2})}원 <i className={data.forex.usdChange >= 0 ? "up" : "down"}>{data.forex.usdChange >= 0 ? "▲" : "▼"}{Math.abs(data.forex.usdChange).toFixed(2)}원</i></span>
              <span><small>100엔/원</small> {data.forex.jpyKrw.toLocaleString("ko-KR", {minimumFractionDigits:2, maximumFractionDigits:2})}원 <i className={data.forex.jpyChange >= 0 ? "up" : "down"}>{data.forex.jpyChange >= 0 ? "▲" : "▼"}{Math.abs(data.forex.jpyChange).toFixed(2)}원</i></span>
            </section>
          )}
          <section className="market-verdict fp-verdict">
            <small>FLOWPULSE AI BRIEFING</small>
            <h1>{market === "NASDAQ" ? usBrief : insight!.text}</h1>
            <p>{asOf} 기준 · 데이터·신호 신뢰도 {confidence}/100 · 상승 확률이 아닌 현재 신호의 신뢰 수준</p>
          </section>
          <section className="temperature-panel">
            <div><span>{market === "NASDAQ" ? "시장 온도" : "수급 온도"}</span><strong>{market === "NASDAQ" ? usTemperature : insight!.temperature}</strong><b>{market === "NASDAQ" ? usLabel : insight!.label}</b></div>
              <div className="temperature-track"><i style={{left:`${Math.max(5, Math.min(95, market === "NASDAQ" ? usTemperature : insight!.temperature))}%`}} /></div>
            <div className="temperature-labels"><span>매도 우위</span><span>중립</span><span>매수 우위</span></div>
          </section>
          <section className="fp-metrics" aria-label="Flow 핵심 지표">
            <article><span>Core Flow Sync</span><strong>{sync >= 0 ? "+" : ""}{sync}</strong><small>{syncLabel}</small></article>
            <article><span>Flow Confidence</span><strong>{confidence} / 100</strong><small>데이터·신호 신뢰도</small></article>
            <article><span>가장 중요한 변화</span><strong>{market === "NASDAQ" ? usLabel : insight!.label}</strong><small>{market === "NASDAQ" ? "미국 3대 지수" : "외국인·기관·프로그램 종합"}</small></article>
          </section>
          <div className="fp-section-title"><h2>실시간 수급 스냅샷</h2><span>매일 08:00 리셋 · 1분 자동 갱신</span></div>
          <div className="flow-cards">
            {market !== "NASDAQ" && actors.map(([name, total, delta, tone]) => (
              <article className={tone} key={name}>
                <small>{name} · 최근 {name === "프로그램" ? programWindow.minutes : investorWindow.minutes}분</small>
                <strong style={{whiteSpace:"nowrap"}}>{name !== "프로그램" && !data?.investorAvailable ? "NXT 집계 대기" : delta === null ? "수집 중" : signed(delta)}</strong>
                <span>오늘 누적</span><b style={{whiteSpace:"nowrap"}}>{name !== "프로그램" && !data?.investorAvailable ? "NXT 집계 대기" : signed(total)}</b>
                <em className={`flow-shift ${flowShift(total, delta).includes("약화") ? "weakening" : ""}`}>Flow Shift · {flowShift(total, delta)}</em>
                <svg viewBox="0 0 120 24"><path d="M0 14 L12 17 L25 11 L38 14 L52 9 L66 13 L80 8 L96 12 L108 10 L120 16" /></svg>
              </article>
            ))}
            {market === "NASDAQ" && usIndices.map((index, i) => (
              <article className={`market-index index-${i}`} key={index.code}>
                <small>{index.name}</small>
                <strong>{index.price.toLocaleString("en-US")}</strong>
                <span>전일 대비</span><b className={index.changeRate >= 0 ? "up" : "down"}>{index.changeRate >= 0 ? "+" : ""}{index.changeRate.toFixed(2)}%</b>
              </article>
            ))}
            {(data?.leaders ?? []).map((stock) => market === "NASDAQ" ? (
              <article className={`market-index us-leader ${stock.changeRate >= 0 ? "stock-up" : "stock-down"}`} key={stock.code}>
                <small>{stock.name}</small>
                <strong>${stock.price.toLocaleString("en-US")}</strong>
                <div className="market-moves"><span>전일 대비<b className={stock.changeRate >= 0 ? "up" : "down"}>{stock.changeRate >= 0 ? "+" : ""}{stock.changeRate.toFixed(2)}%</b></span>{stock.preMarketPrice && <span>프리장 시작 대비<b className={stock.preMarketChangeRate! >= 0 ? "up" : "down"}>{stock.preMarketChangeRate! >= 0 ? "+" : ""}{stock.preMarketChangeRate!.toFixed(2)}%</b></span>}</div>
              </article>
            ) : (
              <article key={stock.code} className={`leader-flow ${stock.changeRate >= 0 ? "stock-up" : "stock-down"}`}>
                <small>{stock.name}</small>
                <strong style={{whiteSpace:"nowrap"}}>{stock.price.toLocaleString("ko-KR")}원 <em>{stock.changeRate >= 0 ? "▲" : "▼"}{Math.abs(stock.changeRate).toFixed(2)}%</em></strong>
                <div><span>개인<b>{stock.personalAvailable === false ? stockInvestorPending : stockInvestorReady(stock) ? signedShares(stock.personal) : "집계 대기"}</b></span><span>외국인<b>{stockInvestorReady(stock)?signedShares(stock.foreign):"집계 대기"}</b></span><span>기관<b>{stockInvestorReady(stock)?signedShares(stock.institution):"집계 대기"}</b></span><span>프로그램<b>{signed(stock.program)}</b></span></div>
              </article>
            ))}
            {!data?.leaders?.length && (market === "KOSDAQ" ? ["제주반도체", "에코프로"] : market === "NASDAQ" ? ["SOXL", "KORU", "SanDisk"] : ["삼성전자", "SK하이닉스"]).map((name) => (
              <article key={name} className="leader-flow leader-pending">
                <small>{name}</small><strong>실데이터 재연결 필요</strong>
                <div><span>외국인<b>조회 대기</b></span><span>기관<b>조회 대기</b></span></div>
                <footer>API 재시작 후 자동 표시</footer>
              </article>
            ))}
          </div>
          {market === "KOSPI" && <section className="fp-signals">
            <div className="fp-section-title"><h2>우선 확인할 신호</h2><span>매일 08:00 리셋 · 1분 자동 갱신</span></div>
            <div className="fp-signal-grid">
              <article className="fp-signal-card">
                <header><div><small>PROGRAM FLOW</small><h3>삼성전자</h3></div><b>{signalStatus(samsung)}</b></header>
                <p>{signalCopy(samsung)} · 외국인·기관은 장중 추정 집계</p>
                <dl><div><dt>현재가</dt><dd>{stockPrice(samsung,"수집 중")}</dd></div><div><dt>프로그램</dt><dd className={samsung?.program! >= 0 ? "positive" : "negative"}>{samsung ? direction(samsung.program) : "수집 중"}</dd></div><div><dt>기관</dt><dd>{samsung && stockInvestorReady(samsung) ? direction(samsung.institution) : stockInvestorPending}</dd></div></dl>
                <footer>08:00 첫 수집값을 0으로 두고 이후 변화량을 표시합니다.</footer>
              </article>
              <article className="fp-signal-card caution">
                <header><div><small>PROGRAM FLOW</small><h3>SK하이닉스</h3></div><b>{signalStatus(hynix)}</b></header>
                <p>{signalCopy(hynix)} · 외국인·기관은 장중 추정 집계</p>
                <dl><div><dt>현재가</dt><dd>{stockPrice(hynix,"수집 중")}</dd></div><div><dt>프로그램</dt><dd className={hynix?.program! >= 0 ? "positive" : "negative"}>{hynix ? direction(hynix.program) : "수집 중"}</dd></div><div><dt>기관</dt><dd>{hynix && stockInvestorReady(hynix) ? direction(hynix.institution) : stockInvestorPending}</dd></div></dl>
                <footer>08:00 첫 수집값을 0으로 두고 이후 변화량을 표시합니다.</footer>
              </article>
            </div>
          </section>}
          <section className="panel briefing-chart fp-chart-panel">
            <div className="title"><h2>{market === "NASDAQ" ? "미국 3대 지수 장중 흐름" : "투자 주체별 누적 순매수/순매도"}</h2><span>{market === "NASDAQ" ? "(%)" : "(억원)"}</span></div>
            {market === "NASDAQ" ? <IndexChart indices={usIndices}/> : <Chart investors={investors} program={program} investorAvailable={data?.investorAvailable} />}
          </section>
        </>
      )}
    </div>
  );
}

function LegacyAiBriefing({ markets, loading }: { markets: Partial<Record<Market, MarketFlow>>; loading: Record<Market, boolean> }) {
  const [market, setMarket] = useState<Market>("KOSPI"),
    [view, setView] = useState<"타임라인"|"요약"|"중요 알림">("타임라인"),
    data = markets[market], snapshot = data?.snapshot,
    facts = market === "NASDAQ" ? (data?.indices ?? []).map(index=>({name:index.name,value:index.changeRate})) : snapshot ? [{name:"개인",value:snapshot.personal},{name:"외국인",value:snapshot.foreign},{name:"기관",value:snapshot.institution},{name:"프로그램",value:snapshot.program}] : [],
    strongest = [...facts].sort((a,b)=>Math.abs(b.value)-Math.abs(a.value))[0],
    dir = (v:number)=>v>0?"순매수":v<0?"순매도":"중립",
    signed = (v:number)=>`${formatEok(v)}억원`,
    asOf = data?.asOf ? new Date(data.asOf).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : "--:--",
    valueText = (value:number)=>market === "NASDAQ" ? `${value>=0?"+":""}${value.toFixed(2)}%` : signed(value),
    direction = (value:number)=>market === "NASDAQ" ? value>0?"상승":value<0?"하락":"보합" : dir(value),
    ready = market === "NASDAQ" ? !!data?.indices?.length : !!snapshot,
    usTimelineGroups = market === "NASDAQ"
      ? (() => {
          const indices = (data?.indices ?? []).map(index=>({
              ...index,
              points:[...index.points].filter(point=>{const [h,m]=point.time.split(":").map(Number), minutes=h*60+m; return minutes>=570&&minutes<=960;}).sort((a,b)=>a.time.localeCompare(b.time)),
            })),
            latest = indices.flatMap(index=>index.points.map(point=>point.time)).sort().at(-1),
            latestMinutes = latest ? latest.split(":").map(Number).reduce((hour,minute)=>hour*60+minute) : 570,
            times = Array.from({length:Math.max(1,Math.floor((latestMinutes-570)/30)+1)},(_,index)=>{
              const minutes=570+index*30;
              return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
            });
          return times.map(time=>{
            const rows = indices.map(index=>{
                const point=index.points.find(item=>item.time===time), base=index.points[0]?.value;
                return {name:index.name,change:point&&base?(point.value/base-1)*100:null};
              });
            return {time:`${time} 뉴욕`,rows};
          }).reverse();
        })()
      : [],
    timelineEvents = market === "NASDAQ" ? [] : (data?.investorPoints ?? []).slice(1).map((point,index) => {
          const source = data?.investorPoints ?? [], previous = source[index],
            changes = (["personal","foreign","institution","program"] as const).map(key=>({key,value:point[key]-previous[key]})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)),
            largest = changes[0], names = {personal:"개인",foreign:"외국인",institution:"기관",program:"프로그램"};
          return { time:new Date(point.time).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}), name:names[largest.key], direction:largest.value>0?"순매수 확대":largest.value<0?"순매도 확대":"변화 없음", change:largest.value, total:point[largest.key], basis:"직전 1분 스냅샷 대비" };
        }).slice(-6).reverse(),
    fiveMinuteMoves = (data?.indices ?? []).map(index=>{
      const points=[...index.points].sort((a,b)=>a.time.localeCompare(b.time)), last=points.at(-1)?.value, previous=points.at(-2)?.value;
      return {name:index.name,change:last&&previous?(last/previous-1)*100:0,count:points.length};
    }),
    firstStored = data?.collection?.stored ? (market === "NASDAQ" ? data.indices?.[0]?.points[0]?.time : data.investorPoints?.[0]?.time ? new Date(data.investorPoints[0].time).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}) : undefined) : undefined,
    periodSummary = market === "NASDAQ"
      ? `${fiveMinuteMoves[0]?.count ?? 0}개 5분봉을 누적 분석했습니다. 최근 5분은 ${fiveMinuteMoves.map(item=>`${item.name} ${item.change>=0?"+":""}${item.change.toFixed(2)}%`).join(" · ")}입니다.`
      : `${firstStored ?? asOf}부터 1분 스냅샷 ${data?.collection?.stored ?? 0}개를 누적했습니다. ${timelineEvents[0] ? timelineEvents[0].change === 0 ? "최근 1분간 주요 수급 변화는 없습니다." : `${timelineEvents[0].name}이 직전 구간 대비 ${valueText(timelineEvents[0].change)} 변했습니다.` : "다음 스냅샷부터 구간 변화를 계산합니다."}`;
  return <>
    <header className="briefing-header"><b><span>FlowPulse</span> <i>AI</i></b><small>{new Date().toLocaleDateString("ko-KR")} {asOf} 기준 · 1분 누적 {data?.collection?.stored ?? 0}개</small></header>
    <div className="segments">{(["KOSPI","KOSDAQ","NASDAQ"] as Market[]).map(v=><button key={v} className={market===v?"active":""} onClick={()=>setMarket(v)}>{v}</button>)}</div>
    {loading[market] || !ready || !strongest ? <section className="ai-loading"><Sparkles/><h2>FlowPulse 실데이터를 분석하고 있습니다.</h2></section> : <>
      {market !== "NASDAQ" && <section className="kospi-strip"><b>{market}</b><strong>{data?.index?.price.toLocaleString("ko-KR") ?? "지수 재연결 중"}</strong>{data?.index && <span className={data.index.changeRate>=0?"up":"down"}>{data.index.changeRate>=0?"▲":"▼"}{Math.abs(data.index.changeRate).toFixed(2)}%</span>}</section>}
      {market === "NASDAQ" && data?.forex && <section className="kospi-strip forex-strip"><b>환율</b><span><small>달러/원</small> {data.forex.usdKrw.toLocaleString("ko-KR",{maximumFractionDigits:2})}원</span><span><small>100엔/원</small> {data.forex.jpyKrw.toLocaleString("ko-KR",{maximumFractionDigits:2})}원</span></section>}
      <section className="ai-head"><small>AI 라이브 브리핑 · {asOf} · {market === "NASDAQ" ? `${fiveMinuteMoves[0]?.count ?? 0}개 5분봉 누적` : `1분 스냅샷 ${data?.collection?.stored ?? 0}개 누적`}</small><h1>{strongest.name} {direction(strongest.value)}가<br/>가장 크게 나타납니다.</h1><p>{periodSummary}</p></section>
      <div className="ai-tabs">{(["타임라인","요약","중요 알림"] as const).map(v=><button key={v} className={view===v?"active":""} onClick={()=>setView(v)}>{v}</button>)}</div>
      {view==="타임라인" && (market === "NASDAQ" ? <section className="ai-timeline us-timeline">{usTimelineGroups.map((group,index)=><article key={group.time}><i>{index+1}</i><time>{group.time}</time><div className="us-index-rows"><small>09:30 개장 대비 · 30분 구간</small>{group.rows.map((row,rowIndex)=><p key={row.name} className={`us-index-${rowIndex}`}><b>{row.name}</b><span>{row.change===null?"대기":row.change>0?"상승":row.change<0?"하락":"보합"}</span><strong>{row.change===null?"수집 전":`${row.change>=0?"+":""}${row.change.toFixed(2)}%`}</strong></p>)}</div></article>)}</section> : <section className="ai-timeline">{timelineEvents.length ? timelineEvents.map((event,index)=><article key={`${event.time}-${event.name}-${index}`} className={event.change>0?"mint":event.change<0?"orange":"violet"}><i>{index+1}</i><time>{event.time}</time><div><h3>{event.name} {event.direction}</h3><p><span>{event.basis}</span><strong>{valueText(event.change)}</strong></p><small>현재 누적 {valueText(event.total)}</small></div></article>) : <article><time>{asOf}</time><div><h3>첫 스냅샷 저장 완료</h3><p>다음 1분 데이터부터 변화 이벤트를 생성합니다.</p></div></article>}</section>)}
      {view==="요약" && <section className="ai-summary"><h2>FlowPulse AI 누적 요약</h2><p>{periodSummary}</p><div className="fact-grid">{facts.map(fact=><article key={fact.name}><small>{fact.name}</small><b>{valueText(fact.value)}</b><span>{direction(fact.value)}</span></article>)}</div></section>}
      {view==="중요 알림" && <section className="ai-summary"><h2>최근 중요 변화</h2><p>{market === "NASDAQ" ? usTimelineGroups[0] ? `${usTimelineGroups[0].time} · ${usTimelineGroups[0].rows.map(row=>`${row.name} ${row.change===null?"수집 전":`${row.change>=0?"+":""}${row.change.toFixed(2)}%`}`).join(" · ")}` : "첫 30분 구간을 수집 중입니다." : timelineEvents[0] ? `${timelineEvents[0].time} ${timelineEvents[0].name} ${timelineEvents[0].direction} · ${valueText(timelineEvents[0].change)}` : "두 번째 스냅샷 수집 후 중요 변화를 표시합니다."}</p></section>}
    </>}
  </>;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("Flow"),
    [favorites,setFavorites] = useState<SearchableStock[]>([]),
    [observations,setObservations] = useState<Observation[]>([]),
    [ended,setEnded] = useState<EndedObservation[]>([]),
    marketState = useMarkets(), candidates = useCandidates();
  const startObservation = (stock:SearchableStock) => setObservations(current=>current.some(item=>item.stock.code===stock.code)?current:[...current,{stock,startedAt:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}),entries:[],confidence:78}]),
    toggleFavorite = (stock:SearchableStock) => setFavorites(current=>current.some(item=>item.code===stock.code)?current.filter(item=>item.code!==stock.code):[...current,stock]),
    saveEntry = (code:string,entry:EntryRecord) => setObservations(current=>current.map(item=>item.stock.code===code?{...item,entries:[...item.entries,entry]}:item)),
    endObservation = (code:string,reason:string) => {const target=observations.find(item=>item.stock.code===code);if(!target)return;setEnded(items=>[{stock:target.stock,endedAt:new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}),reason,entryCount:target.entries.length},...items]);setObservations(current=>current.filter(item=>item.stock.code!==code))};
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  return (
    <main className="fp-shell">
      <aside className="fp-sidebar">
        <b>FlowPulse <i>AI</i></b>
        <nav>
          {(["Flow", "AI", "Watch", "Feed", "Me"] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {t === "Flow" ? <Home /> : t === "AI" ? <ChartNoAxesCombined /> : t === "Watch" ? <Heart /> : t === "Feed" ? <MessageSquare /> : <UserRound />}
              <span>{t === "Flow" ? "Flow" : t === "AI" ? "종목" : t === "Watch" ? "관심 종목" : t === "Feed" ? "Feed" : "Me"}</span>
            </button>
          ))}
        </nav>
        <small>실시간 시장 데이터<br/>FlowPulse v0.2</small>
      </aside>
      <div className="app fp-content">
        {tab === "Flow" ? (
          <MarketDashboard markets={marketState.markets} loading={marketState.loading} />
        ) : tab === "AI" ? (
          <StockAnalysis stocks={candidates.stocks} candidateMeta={candidates} observedCodes={observations.map(item=>item.stock.code)} favoriteCodes={favorites.map(stock=>stock.code)} onFavorite={toggleFavorite} onWatch={stock=>{startObservation(stock);setTab("Watch")}} onOpenWatch={()=>setTab("Watch")} />
        ) : tab === "Watch" ? (
          <Watchlist favorites={favorites} observations={observations} ended={ended} onStart={startObservation} onEntry={saveEntry} onEnd={endObservation} />
        ) : tab === "Feed" ? (
          <Pending title="데이터 기반 Feed" />
        ) : (
          <Pending title="내 정보" />
        )}
      </div>
    </main>
  );
}
