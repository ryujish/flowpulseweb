import { useRef, useState } from "react";
import { Bell, Check, Download, Search, Star, X } from "lucide-react";
import { toPng } from "html-to-image";
import "./stock-analysis.css";

type StockView = "가격·수급 차트" | "수급 분석" | "판단 근거";
export type SearchableStock = { code:string; name:string; market:string; price:number; changeRate:number; personal:number; foreign:number; institution:number; program:number; programRecent5?:number|null; strategies?:string[]; playbook?:string; cci?:number|null; cciEma?:number|null };

const fallbackStocks:SearchableStock[] = [
  {code:"005930",name:"삼성전자",market:"KOSPI",price:230000,changeRate:-0.43,personal:-30000,foreign:-34000,institution:-18000,program:820},
  {code:"000660",name:"SK하이닉스",market:"KOSPI",price:1428000,changeRate:0.42,personal:198922,foreign:-56357,institution:32908,program:-4220},
  {code:"080220",name:"제주반도체",market:"KOSDAQ",price:72400,changeRate:-2.4,personal:18420,foreign:-12780,institution:-4320,program:560},
  {code:"086520",name:"에코프로",market:"KOSDAQ",price:108000,changeRate:1.2,personal:-9120,foreign:6810,institution:1740,program:210},
], paths = [
  "M2 20 L15 17 L28 18 L40 12 L54 14 L68 7 L88 3",
  "M2 5 L15 8 L28 10 L40 15 L54 14 L68 19 L88 20",
  "M2 4 L15 7 L28 9 L40 14 L54 17 L68 20 L88 21",
  "M2 7 L15 9 L28 8 L40 13 L54 15 L68 18 L88 20",
], signed = (value:number,unit:string) => `${value>0?"+":""}${(unit==="억원"?value/100:value).toLocaleString("ko-KR",unit==="억원"?{minimumFractionDigits:1,maximumFractionDigits:1}:{})}${unit}`,
  programText = (value:number) => `${value>0?"+":""}${(value/100).toLocaleString("ko-KR",{minimumFractionDigits:1,maximumFractionDigits:1})}억원`;

const playbooks:Record<string,[string,string]> = {
  PROGRAM_MOMENTUM:["PROGRAM MOMENTUM","최근 5분 프로그램 순매수·가속"],
  SMART_MONEY_SYNC:["SMART MONEY SYNC","외국인·기관 동조"],
  VOLUME_REVERSAL:["VOLUME REVERSAL","거래량 반전"],
  BREAKOUT_CONFIRM:["BREAKOUT CONFIRM","돌파·수급 확인"],
  ENVELOPE_REVERSAL:["ENVELOPE REVERSAL","엔벨로프 하단 재진입"],
  CCI_EMA_CROSS:["CCI + EMA","CCI 20 · EMA 13 상향 교차"],
};

export default function StockAnalysis({stocks=[],candidateMeta,observedCodes=[],favoriteCodes=[],onWatch,onOpenWatch,onFavorite}:{stocks?:SearchableStock[];candidateMeta?:{universeCount:number;priceCount:number;calculatedAt?:string};observedCodes?:string[];favoriteCodes?:string[];onWatch?:(stock:SearchableStock)=>void;onOpenWatch?:()=>void;onFavorite?:(stock:SearchableStock)=>void}) {
  const available = [...stocks,...fallbackStocks.filter(stock=>!stocks.some(candidate=>candidate.code===stock.code))],
    captureRef = useRef<HTMLDivElement>(null), [capturing,setCapturing] = useState(false),
    [screen,setScreen] = useState<"candidates"|"analysis">("candidates"), [sheetOpen,setSheetOpen] = useState(false),
    [candidateFilter,setCandidateFilter] = useState("전체"),
    [view,setView] = useState<StockView>("판단 근거"), [range,setRange] = useState("5분"),
    [query,setQuery] = useState(""), [selected,setSelected] = useState(available[0]),
    results = query.trim()?available.filter(stock=>`${stock.name} ${stock.code}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0,6):[],
    bullish = selected.program>0,
    verdict = bullish&&selected.changeRate<0?"진입 확인 대기":bullish?"매수 흐름 관찰":"주의 관찰",
    verdictCopy = bullish?`프로그램 매수는 확인됐지만 가격 ${selected.changeRate<0?"반전":"추세 유지"}은 추가 확인이 필요합니다.`:"프로그램 수급이 순매도로 전환되어 위험 조건을 먼저 확인해야 합니다.",
    actorRows = [
      ["프로그램","수집 대기","수집 대기",programText(selected.program),bullish?"매수 유지":"순매도",bullish?"관찰 중":"-","program"],
      ["외국인","수집 대기","수집 대기",signed(selected.foreign,"주"),selected.foreign>0?"순매수":"순매도","-","foreign"],
      ["기관","수집 대기","수집 대기",signed(selected.institution,"주"),selected.institution>0?"순매수":"순매도","-","institution"],
      ["개인","수집 대기","수집 대기",signed(selected.personal,"주"),selected.personal>0?"순매수":"순매도","-","personal"],
    ] as const,
    observed = observedCodes.includes(selected.code),
    candidateStocks = stocks.filter(stock=>candidateFilter==="전체" || candidateFilter==="프로그램"&&stock.programRecent5!>0 || candidateFilter==="외국인"&&stock.foreign>0 || candidateFilter==="기관"&&stock.institution>0 || candidateFilter==="복합수급"&&[stock.programRecent5??0,stock.foreign,stock.institution].filter(value=>value>0).length>=2).slice(0,10),
    choose = (stock:SearchableStock) => {setSelected(stock);setQuery("");setView("판단 근거");setScreen("analysis");},
    startObservation = (stock:SearchableStock) => { setSelected(stock); observedCodes.includes(stock.code) ? onOpenWatch?.() : setSheetOpen(true); },
    confirmObservation = () => { setSheetOpen(false); onWatch?.(selected); },
    capture = async () => {
      if (!captureRef.current || capturing) return;
      setCapturing(true);
      try {
        const url = await toPng(captureRef.current,{pixelRatio:2,cacheBust:true,backgroundColor:getComputedStyle(document.body).backgroundColor,filter:node=>!(node instanceof HTMLElement&&node.classList.contains("capture-button"))}), link = document.createElement("a");
        link.download = `FlowPulse-${selected.code}-${new Date().toISOString().slice(0,10)}.png`; link.href = url; link.click();
      } finally { setCapturing(false); }
    };
  return <div className="stock-analysis" ref={captureRef}>
    <header className="stock-header"><div><small>STOCK ANALYSIS</small><h1>종목 분석</h1></div><div className="stock-header-actions"><span><b>● 정상 수집</b> · 10:24 기준</span><button className="capture-button" onClick={capture} disabled={capturing} aria-label="화면 저장"><Download/></button></div></header>
    <div className="stock-mode-tabs" role="tablist"><button role="tab" aria-selected={screen==="candidates"} className={screen==="candidates"?"active":""} onClick={()=>setScreen("candidates")}>관찰 후보</button><button role="tab" aria-selected={screen==="analysis"} className={screen==="analysis"?"active":""} onClick={()=>setScreen("analysis")}>종목 검색</button></div>
    {screen === "candidates" ? <section className="candidate-screen">
      <div className="candidate-head"><div><h2>관찰 후보</h2><p>거래대금 상위 {candidateMeta?.universeCount?candidateMeta.universeCount+"개":"수집 중"} → 가격 조건 {candidateMeta?.priceCount?candidateMeta.priceCount+"개":"-"} → 병렬 전략 후보 {stocks.length?stocks.length+"개":"수집 중"} · {candidateMeta?.calculatedAt?new Date(candidateMeta.calculatedAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"갱신 중"} 기준</p></div><span>● {stocks.length?"실시간 정상":"전략 신호 계산 중"}</span></div>
      <div className="candidate-filters">{["전체","프로그램","외국인","기관","복합수급"].map(item=><button className={candidateFilter===item?"active":""} onClick={()=>setCandidateFilter(item)} aria-pressed={candidateFilter===item} key={item}>{item}</button>)}</div>
      <div className="candidate-list">{candidateStocks.map((stock,index)=>{
        const isObserved=observedCodes.includes(stock.code),isBullish=(stock.programRecent5??0)>0,playbook=playbooks[stock.playbook??""]??["FLOW WATCH","복합 수급 관찰"];
        return <article className="stock-surface candidate-card" key={stock.code}>
          <div className="candidate-rank">{index+1}</div>
          <div className="candidate-title"><div><h3>{stock.name}</h3><small>{stock.code} · {stock.market}</small></div><div><b>{playbook[0]}</b><span>{playbook[1]}</span></div></div>
          <dl><div><dt>현재가</dt><dd>{stock.price.toLocaleString("ko-KR")}원 · {stock.changeRate>=0?"+":""}{stock.changeRate.toFixed(2)}%</dd></div><div><dt>주요 신호</dt><dd>{playbook[1]}</dd></div><div><dt>CCI / EMA</dt><dd>{stock.cci===null||stock.cci===undefined?"수집 중":stock.cci.toFixed(1)+" / "+stock.cciEma?.toFixed(1)}</dd></div><div><dt>프로그램 최근 5분</dt><dd>{stock.programRecent5===null||stock.programRecent5===undefined?"수집 중":programText(stock.programRecent5)}</dd></div><div><dt>동시 충족 전략</dt><dd>{stock.strategies?.length??1}개</dd></div><div><dt>다음 조건</dt><dd>{isBullish?"프로그램 가속 유지":"가격·거래량 확인"}</dd></div></dl>
          <p>반대 근거 · {stock.foreign<0?"외국인 순매도 지속":"거래량 회복 미확인"}</p><div className="candidate-actions"><button onClick={()=>choose(stock)}>분석 보기</button><button onClick={()=>startObservation(stock)}>{isObserved?"관찰 중 · 보기":"관찰 시작"}</button></div>
        </article>
      })}</div>
      {!candidateStocks.length&&<div className="candidate-empty">현재 조건을 충족한 관찰 후보가 없습니다.<small>기준을 낮추지 않고 다음 갱신을 기다립니다.</small></div>}<small className="candidate-note">후보 점수는 기대수익률이나 상승 확률이 아닌 관찰 우선순위입니다.</small>
    </section> : <>
    <div className="stock-search"><div className="stock-search-row"><label><Search/><input aria-label="종목명 또는 종목코드 검색" placeholder="종목명 또는 종목코드 검색" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&results[0]) choose(results[0]);}}/></label><button className={favoriteCodes.includes(selected.code)?"favorite active":"favorite"} onClick={()=>onFavorite?.(selected)} aria-label={favoriteCodes.includes(selected.code)?"일반 관심 해제":"일반 관심 등록"}><Star fill={favoriteCodes.includes(selected.code)?"currentColor":"none"}/></button></div>{query&&<div className="stock-search-results">{results.length?results.map(stock=><button key={stock.code} onClick={()=>choose(stock)}><span><b>{stock.name}</b><small>{stock.code} · {stock.market}</small></span><span>{stock.price.toLocaleString("ko-KR")}원 <small>{stock.changeRate>=0?"▲":"▼"}{Math.abs(stock.changeRate).toFixed(2)}%</small></span></button>):<p>일치하는 종목을 찾을 수 없습니다. 종목명 또는 6자리 코드를 확인해 주세요.</p>}</div>}</div>
    <div className="stock-price"><div><small>{selected.name} · {selected.code} · {selected.market}</small><strong>{selected.price.toLocaleString("ko-KR")}원</strong></div><span className={selected.changeRate>=0?"up":"down"}>{selected.changeRate>=0?"▲":"▼"}{Math.abs(selected.changeRate).toFixed(2)}%</span></div>
    <section className="stock-surface playbook-summary"><header><div><small>PROGRAM DIP REVERSAL · v1.0</small><h2>{selected.name} · {verdict}</h2></div><span>{bullish?"확인 대기":"주의 관찰"}</span></header><p>{verdictCopy}</p><div className="playbook-metrics"><div><span>Flow Shift</span><strong>{bullish?"매도 → 매수 탐색":"매수 → 매도 전환"}</strong></div><div><span>Flow Sync</span><strong>{bullish?"+32 · 약한 매수 동조":"-41 · 매도 우위"}</strong></div><div><span>Flow Confidence</span><strong>78 / 100</strong></div><div><span>Flow Divergence</span><strong>{selected.changeRate<0&&bullish?"가격↓ / 프로그램↑":"방향 확인 중"}</strong></div><div><span>Flow Persistence</span><strong>{bullish?"매수 18분":"매도 7분"}</strong></div><div><span>Flow Acceleration</span><strong>최근 5분 {bullish?"매수 유지":"매도 강화"}</strong></div></div><div className="condition-progress"><div><span>확인 조건 3개 중 2개 충족</span><b>다음 · 직전 5분봉 고가 돌파</b></div><progress max="3" value="2"/></div><small>데이터와 신호의 신뢰도이며 상승 또는 수익 확률이 아닙니다.</small><div className="playbook-actions"><button onClick={()=>onFavorite?.(selected)}>{favoriteCodes.includes(selected.code)?"관심 등록됨":"일반 관심 등록"}</button><button onClick={()=>startObservation(selected)}>{observed?"관찰 중 · 관심 종목 보기":"관찰 시작"}</button></div></section>
    <div className="stock-tabs" role="tablist">{(["판단 근거","수급 분석","가격·수급 차트"] as StockView[]).map(item=><button role="tab" aria-selected={view===item} className={view===item?"active":""} onClick={()=>setView(item)} key={item}>{item}</button>)}</div>

    {view === "수급 분석" && <><section className="stock-surface actor-analysis"><div className="stock-section-head"><div><h2>투자 주체별 수급</h2><small>최근 5분 · 15분 · 오늘 누적</small></div></div><div className="actor-table"><div className="actor-table-head"><span>주체</span><span>최근 5분</span><span>최근 15분</span><span>오늘 누적</span><span>Flow Shift</span><span>지속</span><span>흐름</span></div>{actorRows.map(([name,five,fifteen,total,shift,duration,tone],index)=><div className={`actor-row ${tone}`} key={name}><span>{name}</span><span>{five}</span><span>{fifteen}</span><span>{total}</span><span>{shift}</span><span>{duration}</span><svg viewBox="0 0 90 24" aria-label={`${name} 수급 흐름`}><path d={paths[index]}/></svg></div>)}</div></section><section className="stock-surface analysis-summary"><div><span>Flow Sync</span><strong>{bullish?"+32":"-41"}</strong><small>{bullish?"약한 매수 동조":"매도 우위"}</small></div><div><span>Flow Confidence</span><strong>78 / 100</strong><small>데이터·신호 신뢰도</small></div><div><span>Flow Divergence</span><strong>{selected.changeRate<0&&bullish?"가격↓ / 프로그램↑":"방향 확인 중"}</strong><small>가격·프로그램 비교</small></div></section><p className="analysis-copy">{selected.name}의 실제 제공 수급을 기준으로 분석합니다. 최근 구간값은 수집 완료 후 표시됩니다.</p></>}

    {view === "판단 근거" && <><section className="stock-surface judgment-summary"><span>상태 변화</span><b>{verdict}</b><p>직전 매수 유지에서 현재 {bullish?"반전 조건 확인":"매수 → 매도 전환 탐색"} 상태로 변경됐습니다.</p><small>변경 시각 10:21 · 원본 데이터 10:24 기준</small></section><section className="stock-surface condition-table"><h2>조건 진행률</h2><div><b>5분 Envelope 하단 재진입</b><span>충족</span><small>기준 하단선 상회 · 현재 +0.2%</small></div><div><b>프로그램 최근 5분 순매수</b><span className={bullish?"met":"miss"}>{bullish?"충족":"미충족"}</span><small>기준 0 초과 · 현재 {programText(selected.program)}</small></div><div><b>직전 5분봉 고가 돌파</b><span>대기</span><small>기준 231,000원 · 현재 {selected.price.toLocaleString("ko-KR")}원</small></div></section><section className="evidence-grid"><article className="stock-surface positive"><h2>확인된 근거</h2>{bullish&&<div><span>프로그램 누적</span><strong>{signed(selected.program,"억원")}</strong></div>}{selected.foreign>0&&<div><span>외국인 수급</span><strong>순매수 {signed(selected.foreign,"주")}</strong></div>}{selected.institution>0&&<div><span>기관 수급</span><strong>순매수 {signed(selected.institution,"주")}</strong></div>}<div><span>직전 저점</span><strong>미이탈</strong></div></article><article className="stock-surface opposing"><h2>반대 근거</h2>{!bullish&&<div><span>프로그램 수급</span><strong>순매도 {programText(selected.program)}</strong></div>}{selected.institution<=0&&<div><span>기관 수급</span><strong>순매도</strong></div>}{selected.foreign<=0&&<div><span>외국인 수급</span><strong>순매도 {signed(selected.foreign,"주")}</strong></div>}<div><span>거래량</span><strong>회복 미확인</strong></div><div><span>직전 고가</span><strong>미돌파</strong></div></article></section><section className="stock-surface criteria"><h2>판단 기준 · 5분봉 · v1.0</h2><div><b>확인</b><span>5분 Envelope 하단 재진입</span></div><div><b>추가 확인</b><span>직전 5분봉 고가 돌파</span></div><div><b>무효</b><span>당일 저점 이탈 또는 프로그램 순매도 전환</span></div><button>관찰 시작</button></section></>}

    {view === "가격·수급 차트" && <><section className="stock-surface price-flow-card"><div className="stock-section-head"><div><h2>가격과 투자 주체별 수급</h2><small>가격 · 개인 · 외국인 · 기관 · 프로그램</small></div><div className="range-tabs">{["5분","15분","30분","당일"].map(item=><button className={range===item?"active":""} onClick={()=>setRange(item)} key={item}>{item}</button>)}</div></div><div className="stock-chart-legend"><span className="price">● 가격</span><span className="personal">● 개인</span><span className="foreign">● 외국인</span><span className="institution">● 기관</span><span className="program">● 프로그램</span></div><svg className="price-flow-chart" viewBox="0 0 760 330" role="img" aria-label={`${selected.name} ${range} 가격과 투자 주체별 수급 차트`}>{[55,115,175,235,295].map(y=><line key={y} x1="55" x2="720" y1={y} y2={y} className="grid"/>)}{[55,190,325,460,595,720].map((x,index)=><g key={x}><line x1={x} x2={x} y1="35" y2="295" className="grid"/><text x={x} y="320" textAnchor={index===0?"start":index===5?"end":"middle"}>{["09:15","09:30","09:45","10:00","10:15","10:24"][index]}</text></g>)}<path className="price" d="M55 104 C95 56 125 112 165 96 S235 145 275 127 S345 189 390 174 S455 222 505 205 S590 248 635 235 S685 268 720 276"/><path className="personal" d="M55 154 C135 145 205 165 275 151 S400 177 470 163 S610 188 720 174"/><path className="foreign" d="M55 128 C135 140 210 156 285 171 S430 185 510 203 S635 211 720 225"/><path className="institution" d="M55 181 C125 174 205 188 275 201 S410 216 495 229 S630 244 720 252"/><path className="program" d="M55 263 C130 248 175 241 230 230 S330 218 390 196 S470 151 520 132 S620 95 720 79"/></svg><div className="flow-stats"><div><span>Flow Shift</span><strong>{bullish?"매수 유지":"순매도"}</strong></div><div><span>Flow Sync</span><strong>{bullish?"+32":"-41"}</strong></div><div><span>Flow Confidence</span><strong>78</strong></div><div><span>상태</span><strong>{verdict}</strong></div></div></section><section className="stock-surface stock-check"><div><h2>지금 확인할 것</h2><p>{verdictCopy}</p></div><dl><div><dt>확인 조건</dt><dd>5분 Envelope 하단 재진입</dd></div><div><dt>무효 조건</dt><dd>당일 저점 이탈 / 프로그램 순매도 전환</dd></div></dl></section></>}
    </>}
    {sheetOpen&&<div className="observation-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSheetOpen(false)}}><section className="observation-sheet" role="dialog" aria-modal="true" aria-labelledby="observation-title"><button className="sheet-close" onClick={()=>setSheetOpen(false)} aria-label="관찰 시작 닫기"><X/></button><h2 id="observation-title">관찰 시작</h2><p><b>{selected.name}</b> · Program Dip Reversal</p><small>현재 단계 · {verdict}</small><h3>확인할 조건</h3><ul><li><Check/> 5분 Envelope 하단 재진입</li><li><Check/> 프로그램 최근 5분 순매수 유지</li><li className="pending">○ 직전 5분봉 고가 돌파</li></ul><h3>무효 조건</h3><p>당일 저점 이탈 · 프로그램 최근 5분 순매도 전환</p><h3>알림</h3><div className="observation-alerts"><label><input type="checkbox" defaultChecked/><Bell/> 진입 확인</label><label><input type="checkbox" defaultChecked/><Bell/> 무효 조건</label><label><input type="checkbox" defaultChecked/><Bell/> Rally Exit</label></div><footer><button onClick={()=>setSheetOpen(false)}>취소</button><button onClick={confirmObservation}>관찰 시작</button></footer></section></div>}
  </div>;
}
