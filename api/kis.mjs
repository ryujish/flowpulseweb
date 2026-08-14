import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const required = ["KIS_APP_KEY", "KIS_APP_SECRET"],
  cacheFile = new URL("../.cache/kis-token.json", import.meta.url);
let requestQueue = Promise.resolve();
const paced = (task) => {
  const request = requestQueue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return task();
  });
  requestQueue = request.catch(() => {});
  return request;
};
export function configured(env = process.env) {
  return required.every((key) => Boolean(env[key]));
}
export function normalizeNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : 0;
}
export function normalizePreMarket(data = {}, regularPrice = 0) {
  const quote = data.overMarketPriceInfo, preMarketPrice = normalizeNumber(quote?.overPrice);
  if (!["PRE_MARKET","AFTER_MARKET","POST_MARKET"].includes(quote?.tradingSessionType) || !preMarketPrice) return null;
  return { preMarketPrice, preMarketChangeRate: regularPrice ? Math.round((preMarketPrice / regularPrice - 1) * 10000) / 100 : normalizeNumber(quote.fluctuationsRatio) };
}
export function normalizeFlow(investors = [], program = []) {
  const latest = investors[0] ?? {},
    investorAvailable = [latest.frgn_ntby_tr_pbmn,latest.prsn_ntby_tr_pbmn,latest.orgn_ntby_tr_pbmn].some((value)=>normalizeNumber(value)!==0),
    snapshot = {
      foreign: normalizeNumber(latest.frgn_ntby_tr_pbmn),
      personal: normalizeNumber(latest.prsn_ntby_tr_pbmn),
      institution: normalizeNumber(latest.orgn_ntby_tr_pbmn),
      program: normalizeNumber(program[0]?.whol_smtn_ntby_tr_pbmn),
    },
    programPoints = program
      .map((row, index) => {
        const raw = String(row.bsop_hour ?? row.stck_bsop_date ?? index);
        return {
          time:
            raw.length >= 6 ? `${raw.slice(-6, -4)}:${raw.slice(-4, -2)}` : raw,
          value: normalizeNumber(row.whol_smtn_ntby_tr_pbmn),
        };
      })
      .reverse();
  return { snapshot, programPoints, investorAvailable };
}
export function normalizePrice(output = {}) {
  return {
    price: normalizeNumber(output.stck_prpr),
    changeRate: normalizeNumber(output.prdy_ctrt),
    twentyDay: 0,
  };
}
export function normalizeOpeningQuote(nxt={},nxtBook={},auction={}) {
  const nxtPrice=normalizeNumber(nxt.stck_prpr),ask=normalizeNumber(nxtBook.askp1),bid=normalizeNumber(nxtBook.bidp1),auctionPrice=normalizeNumber(auction.antc_cnpr);
  return {
    nxtPrice:nxtPrice||null,nxtChangeRate:nxtPrice?normalizeNumber(nxt.prdy_ctrt):null,nxtAmount:normalizeNumber(nxt.acml_tr_pbmn),
    nxtSpread:ask&&bid?(ask-bid)/((ask+bid)/2)*100:0,nxtAskQuantity:normalizeNumber(nxtBook.total_askp_rsqn),nxtBidQuantity:normalizeNumber(nxtBook.total_bidp_rsqn),
    auctionPrice:auctionPrice||null,auctionVolume:normalizeNumber(auction.antc_vol),auctionAskQuantity:normalizeNumber(auction.total_askp_rsqn),auctionBidQuantity:normalizeNumber(auction.total_bidp_rsqn),
  };
}
export function normalizeOverseasPrice(output = {}) {
  return {
    price: normalizeNumber(output.last),
    changeRate: normalizeNumber(output.rate),
    twentyDay: 0,
  };
}
export function normalizePreMarketOverseasPrice(output = {}, history = []) {
  const price = normalizeNumber(output.base), regular = history.find((row) => normalizeNumber(row.clos) === price), preMarketPrice = normalizeNumber(output.last);
  return { price, changeRate: normalizeNumber(regular?.rate), preMarketPrice, preMarketChangeRate: price && preMarketPrice ? Math.round((preMarketPrice / price - 1) * 10000) / 100 : 0, twentyDay: 0 };
}
export function isUsPreMarket(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now), value = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0), weekday = parts.find((part) => part.type === "weekday")?.value;
  return !["Sat", "Sun"].includes(weekday) && value("hour") * 60 + value("minute") >= 240 && value("hour") * 60 + value("minute") < 570;
}
export function normalizeInvestorQuantity(investor = {}) {
  return {
    personal: normalizeNumber(investor.prsn_ntby_qty),
    foreign: normalizeNumber(investor.frgn_ntby_qty),
    institution: normalizeNumber(investor.orgn_ntby_qty),
  };
}
export function normalizeInvestorEstimate(rows = []) {
  const latest = rows[0];
  if (!latest) return { foreign: 0, institution: 0, investorAvailable: false, investorEstimated: false };
  return {
    foreign: normalizeNumber(latest.frgn_fake_ntby_qty),
    institution: normalizeNumber(latest.orgn_fake_ntby_qty),
    investorAvailable: true,
    investorEstimated: true,
  };
}
export function resetLeaderFlows(latest = [], opening = [], hasMinuteHistory = false) {
  return latest.map((stock) => {
    const base = opening.find((item) => item.code === stock.code) ?? {};
    return {
      ...stock,
      personal: stock.personal - (base.personal ?? stock.personal),
      foreign: stock.investorEstimated ? stock.foreign : stock.foreign - (base.foreign ?? stock.foreign),
      institution: stock.investorEstimated ? stock.institution : stock.institution - (base.institution ?? stock.institution),
      program: stock.program - (base.program ?? stock.program),
      investorAvailable: stock.investorAvailable || hasMinuteHistory,
    };
  });
}
export function normalizeRank(rows = [], market = "KOSPI") {
  return rows.flatMap((row) => {
    const code = String(row.mksc_shrn_iscd ?? ""), name = String(row.hts_kor_isnm ?? ""), price = normalizeNumber(row.stck_prpr), amount = normalizeNumber(row.acml_tr_pbmn);
    if (!/^\d{6}$/.test(code) || !name || !price || !amount || /KODEX|TIGER|RISE|ACE|SOL |HANARO|PLUS |KOSEF|ETN/.test(name)) return [];
    return [{ code, name, market, price, changeRate: normalizeNumber(row.prdy_ctrt), amount, volumeRatio: normalizeNumber(row.vol_inrt) }];
  });
}
export function calculateCciEma(closes, length = 20, emaLength = 13) {
  const cci = [];
  for (let end=length; end<=closes.length; end++) {
    const window=closes.slice(end-length,end), mean=window.reduce((sum,value)=>sum+value,0)/length,
      deviation=window.reduce((sum,value)=>sum+Math.abs(value-mean),0)/length;
    cci.push(deviation ? (window.at(-1)-mean)/(0.015*deviation) : 0);
  }
  if (!cci.length) return null;
  const alpha=2/(emaLength+1), ema=cci.reduce((values,value,index)=>[...values,index?value*alpha+values[index-1]*(1-alpha):value],[]);
  return { cci:cci.at(-1), ema:ema.at(-1), crossedUp:cci.length>1&&cci.at(-2)<=ema.at(-2)&&cci.at(-1)>ema.at(-1) };
}
export function selectCandidateStrategies(stocks, history, now = Date.now()) {
  const rows=stocks.map((stock) => {
    const points = [...(history.get(stock.code) ?? []), { at:now, value:stock.program }].filter(point=>point.at>=now-15*60000);
    history.set(stock.code, points);
    const start=[...points].reverse().find(point=>point.at<=now-5*60000);
    return {...stock,programRecent5:start?stock.program-start.value:null};
  }), pctl=(value,key)=>{const values=rows.map(key).filter(Number.isFinite).sort((a,b)=>a-b),rank=values.findLastIndex(item=>item<=value);return values.length<2?50:Math.round(rank/(values.length-1)*100)},
    volumeScore=(rvol)=>rvol>=150&&rvol<=300?100:rvol>=120&&rvol<150?70:rvol>300&&rvol<=500?40:0;
  return rows.flatMap(stock=>{
    const tradingValue=Math.max(1,stock.amount), program5=stock.programRecent5??0,
      normalizedProgram=program5*1000000/tradingValue,
      normalizedForeign=stock.foreign*stock.price/tradingValue,
      normalizedInstitution=stock.institution*stock.price/tradingValue,
      programScore=pctl(normalizedProgram,row=>(row.programRecent5??0)*1000000/Math.max(1,row.amount)),
      foreignScore=pctl(normalizedForeign,row=>row.foreign*row.price/Math.max(1,row.amount)), institutionScore=pctl(normalizedInstitution,row=>row.institution*row.price/Math.max(1,row.amount)),
      persistence=program5>0?100:0, programFlow=.75*programScore+.25*persistence,
      confirmation=.6*foreignScore+.4*institutionScore,
      rs=pctl(stock.changeRate,row=>row.changeRate), momentum=rs,
      volume=volumeScore(stock.volumeRatio), breakScore=.35*(stock.changeRate>0?100:0)+.30*(stock.volumeRatio>=120?100:0)+.20*rs+.15*(program5>0?100:0),
      orderPressure=50,
      trendScore=.25*momentum+.20*breakScore+.20*programFlow+.15*volume+.10*orderPressure+.10*confirmation,
      oversold=pctl(-stock.changeRate,row=>-row.changeRate), programShift=programScore,
      priceConfirm=[stock.changeRate>0,stock.programRecent5>0,stock.volumeRatio>=120].filter(Boolean).length/3*100,
      reversalScore=.25*oversold+.25*programShift+.20*priceConfirm+.15*volume+.10*orderPressure+.05*confirmation,
      riskPenalty=(stock.changeRate>=7?15:0)+(stock.volumeRatio>500?10:0)+(stock.price<2000?15:0),
      liquidityScore=Math.round(.45*Math.min(100,tradingValue/10000000000*100)+27.5),
      dataConfidence=[stock.programRecent5!==null,Number.isFinite(stock.foreign),Number.isFinite(stock.institution),stock.cci!==null].filter(Boolean).length*25,
      confirmBonus=Math.min(10,(program5>0&&stock.foreign>0?4:0)+(program5>0&&stock.institution>0?3:0)+(program5>0&&stock.foreign>0&&stock.institution>0?3:0)),
      ambiguous=Math.abs(trendScore-reversalScore)<5, strategy=trendScore>=reversalScore?"KIS_FPA_TREND":"KIS_FPA_REVERSAL",
      fpaScore=Math.round(Math.max(0,Math.min(100,Math.max(trendScore,reversalScore)+confirmBonus-riskPenalty))),
      recommended=fpaScore>=75&&programFlow>=60&&liquidityScore>=60&&dataConfidence>=75&&riskPenalty<20&&!ambiguous,
      grade=recommended?(fpaScore>=85&&programFlow>=75&&dataConfidence>=85?"강력 추천":"추천"):fpaScore>=68?"진입 대기":"관찰",
      qualified=fpaScore>=60&&liquidityScore>=60&&dataConfidence>=75&&riskPenalty<20;
    return qualified?[{...stock,fpaScore,programScore:Math.round(programFlow),foreignScore,institutionScore,riskPenalty,liquidityScore,dataConfidence,trendScore:Math.round(trendScore),reversalScore:Math.round(reversalScore),confirmBonus,ambiguous,recommended,grade,strategies:[strategy],playbook:strategy}]:[];
  }).sort((a,b)=>b.fpaScore-a.fpaScore);
}
export function normalizePublicUsIndices(rows = []) {
  const wanted = new Map([[".IXIC", ["COMP", "NASDAQ"]], [".INX", ["SPX", "S&P 500"]], [".DJI", [".DJI", "DOW"]]]);
  return rows.flatMap((row) => {
    const target = wanted.get(row.reutersCode);
    if (!target) return [];
    const price = normalizeNumber(row.closePrice), opening = normalizeNumber(row.openPrice), time = String(row.localTradedAt ?? "").slice(11, 16), points = opening ? [{ time: "09:30", value: opening }] : [];
    if (price && time !== "09:30") points.push({ time: time || "09:30", value: price });
    return [{ code: target[0], name: target[1], price, changeRate: normalizeNumber(row.fluctuationsRatio), points }];
  });
}
export async function publicUsOverview() {
  const rows = await fetch("https://api.stock.naver.com/index/nation/USA").then((response) => response.ok ? response.json() : Promise.reject(new Error(`미국 지수 폴백 실패 (${response.status})`))),
    indices = normalizePublicUsIndices(rows),
    leaders = (await Promise.all([["SOXL", "SOXL", "SOXL.A"], ["KORU", "KORU", "KORU.A"], ["MU", "Micron", "MU.O"], ["SNDK", "SanDisk", "SNDK.O"], ["SKHY", "SK hynix ADR", "SKHY.O"]].map(async ([code, name, reutersCode]) => {
      const payload = await fetch(`https://polling.finance.naver.com/api/realtime/worldstock/stock/${reutersCode}`).then((response) => response.ok ? response.json() : Promise.reject()).catch(() => ({})), data = payload.datas?.[0] ?? {};
      const price = normalizeNumber(data.closePrice ?? data.price);
      return { code, name, price, changeRate: normalizeNumber(data.fluctuationsRatio), ...normalizePreMarket(data, price), personal: 0, foreign: 0, institution: 0, program: 0 };
    }))).filter((stock) => stock.price > 0);
  return { live: true, source: "네이버 실시간 폴백", asOf: new Date().toISOString(), market: "NASDAQ", indices, leaders };
}
export async function searchUsStocks(query) {
  const autocomplete = await fetch(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`미국 종목 검색 실패 (${response.status})`))),
    items = (autocomplete.items ?? []).filter((item) => item.nationCode === "USA").slice(0, 6);
  return Promise.all(items.map(async (item) => {
    const payload = await fetch(`https://polling.finance.naver.com/api/realtime/worldstock/stock/${encodeURIComponent(item.reutersCode)}`).then((response) => response.ok ? response.json() : Promise.reject(new Error(`미국 종목 시세 실패 (${response.status})`))), data = payload.datas?.[0] ?? {};
    return { code:item.code, name:item.name, market:item.typeName ?? "미국", price:normalizeNumber(data.closePrice ?? data.price), changeRate:normalizeNumber(data.fluctuationsRatio), personal:0, foreign:0, institution:0, program:0 };
  }));
}
export class KisClient {
  #token = null;
  #expires = 0;
  constructor(env = process.env) {
    this.appKey = env.KIS_APP_KEY;
    this.appSecret = env.KIS_APP_SECRET;
    this.base = env.KIS_BASE_URL ?? "https://openapi.koreainvestment.com:9443";
    this.keyId = createHash("sha256")
      .update(this.appKey ?? "")
      .digest("hex")
      .slice(0, 12);
  }
  async token() {
    if (this.#token && Date.now() < this.#expires) return this.#token;
    try {
      const saved = JSON.parse(await readFile(cacheFile, "utf8"));
      if (saved.keyId === this.keyId && Date.now() < saved.expires) {
        this.#token = saved.token;
        this.#expires = saved.expires;
        return this.#token;
      }
    } catch {}
    const response = await fetch(`${this.base}/oauth2/tokenP`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: this.appKey,
          appsecret: this.appSecret,
        }),
      }),
      body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? "KIS 토큰 재발급 제한 중입니다. 잠시 후 자동 재시도하세요."
          : (body.error_description ?? `KIS 인증 실패 (${response.status})`),
      );
    this.#token = body.access_token;
    this.#expires =
      Date.now() + (Number(body.expires_in) || 86400) * 1000 - 60000;
    await mkdir(new URL("../.cache/", import.meta.url), { recursive: true });
    await writeFile(
      cacheFile,
      JSON.stringify({
        keyId: this.keyId,
        token: this.#token,
        expires: this.#expires,
      }),
      { mode: 0o600 },
    );
    return this.#token;
  }
  async get(path, trId, params) {
    return paced(async () => {
      const token = await this.token(),
        url = new URL(path, this.base);
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      const response = await fetch(url, {
          headers: {
            authorization: `Bearer ${token}`,
            appkey: this.appKey,
            appsecret: this.appSecret,
            tr_id: trId,
            custtype: "P",
          },
        }),
        body = await response.json();
      if (!response.ok || (body.rt_cd && body.rt_cd !== "0"))
        throw new Error(body.msg1 ?? `KIS 조회 실패 (${response.status})`);
      return body;
    });
  }
  async marketFlow(market = "KOSPI") {
    const kosdaq = market === "KOSDAQ",
      date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", ""),
      [investor, program] = await Promise.all([
        this.get(
          "/uapi/domestic-stock/v1/quotations/inquire-investor-daily-by-market",
          "FHPTJ04040000",
          {
            FID_COND_MRKT_DIV_CODE: "U",
            FID_INPUT_ISCD: kosdaq ? "1001" : "0001",
            FID_INPUT_DATE_1: date,
            FID_INPUT_ISCD_1: kosdaq ? "KSQ" : "KSP",
            FID_INPUT_DATE_2: date,
            FID_INPUT_ISCD_2: kosdaq ? "1001" : "0001",
          },
        ),
        this.get(
          "/uapi/domestic-stock/v1/quotations/comp-program-trade-today",
          "FHPPG04600101",
          {
            FID_COND_MRKT_DIV_CODE: "UN",
            FID_MRKT_CLS_CODE: kosdaq ? "Q" : "K",
            FID_SCTN_CLS_CODE: "",
            FID_INPUT_ISCD: "",
            FID_COND_MRKT_DIV_CODE1: "",
            FID_INPUT_HOUR_1: "",
          },
        ),
      ]);
    return normalizeFlow(investor.output ?? [], program.output ?? []);
  }
  async candidates() {
    const kstParts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(part=>[part.type,Number(part.value)])),kstHour=kstParts.hour,kstMinutes=kstHour*60+kstParts.minute,opening=kstMinutes>=480&&kstMinutes<545,
      minimumTradingValue=kstHour<10?2000000000:kstHour<11?4000000000:kstHour<12?6000000000:10000000000,
      rank = async (market, input) => normalizeRank((await this.get(
      "/uapi/domestic-stock/v1/quotations/volume-rank", "FHPST01710000",
      { FID_COND_MRKT_DIV_CODE:"J", FID_COND_SCR_DIV_CODE:"20171", FID_INPUT_ISCD:input, FID_DIV_CLS_CODE:"0", FID_BLNG_CLS_CODE:"0", FID_TRGT_CLS_CODE:"111111111", FID_TRGT_EXLS_CLS_CODE:"000000", FID_INPUT_PRICE_1:"", FID_INPUT_PRICE_2:"", FID_VOL_CNT:"", FID_INPUT_DATE_1:"" },
    )).output ?? [], market),
      universe = (await Promise.all([rank("KOSPI", "0001"), rank("KOSDAQ", "1001")])).flat().sort((a,b)=>b.amount-a.amount).slice(0,100),
      priceCandidates = universe.filter(stock=>stock.price>=2000 && stock.amount>=minimumTradingValue && stock.changeRate>=-15 && stock.changeRate<=15).sort((a,b)=>b.amount-a.amount).slice(0,25),
      stocks = [];
    for (const stock of priceCandidates.slice(0,10)) {
      const [investorBody, programBody, chartBody,nxtPriceBody,nxtBookBody,auctionBody] = await Promise.all([
        this.get("/uapi/domestic-stock/v1/quotations/inquire-investor", "FHKST01010900", { FID_COND_MRKT_DIV_CODE:"J", FID_INPUT_ISCD:stock.code }).catch(()=>({output:[]})),
        this.get("/uapi/domestic-stock/v1/quotations/program-trade-by-stock", "FHPPG04650101", { FID_COND_MRKT_DIV_CODE:"UN", FID_INPUT_ISCD:stock.code }).catch(()=>({output:[]})),
        this.get("/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice", "FHKST03010200", { FID_ETC_CLS_CODE:"", FID_COND_MRKT_DIV_CODE:"UN", FID_INPUT_ISCD:stock.code, FID_INPUT_HOUR_1:new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date()).replaceAll(":",""), FID_PW_DATA_INCU_YN:"Y" }).catch(()=>({output2:[]})),
        opening?this.get("/uapi/domestic-stock/v1/quotations/inquire-price","FHKST01010100",{FID_COND_MRKT_DIV_CODE:"NX",FID_INPUT_ISCD:stock.code}).catch(()=>({output:{}})):Promise.resolve({output:{}}),
        opening?this.get("/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn","FHKST01010200",{FID_COND_MRKT_DIV_CODE:"NX",FID_INPUT_ISCD:stock.code}).catch(()=>({output1:{}})):Promise.resolve({output1:{}}),
        opening&&kstMinutes>=530?this.get("/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn","FHKST01010200",{FID_COND_MRKT_DIV_CODE:"J",FID_INPUT_ISCD:stock.code}).catch(()=>({output2:{}})):Promise.resolve({output2:{}}),
      ]), investor = investorBody.output?.[0] ?? {},
        closes=(chartBody.output2??[]).map(row=>normalizeNumber(row.stck_prpr)).filter(Boolean).reverse(), indicator=calculateCciEma(closes),
        current=closes.at(-1),previous=closes.at(-2),currentMean=closes.slice(-20).reduce((sum,value)=>sum+value,0)/20,previousMean=closes.slice(-21,-1).reduce((sum,value)=>sum+value,0)/20;
      stocks.push({ ...stock,...normalizeOpeningQuote(nxtPriceBody.output??{},nxtBookBody.output1??{},auctionBody.output2??{}), ...normalizeInvestorQuantity(investor), program:normalizeNumber(programBody.output?.[0]?.whol_smtn_ntby_tr_pbmn)/1000000, cci:indicator?.cci??null, cciEma:indicator?.ema??null, cciCross:indicator?.crossedUp??false, envelopeReentry:Boolean(closes.length>=21&&previous<=previousMean*.98&&current>currentMean*.98) });
    }
    return { live:true, source:"KIS 거래대금·수급", calculatedAt:new Date().toISOString(), universeCount:universe.length, priceCount:priceCandidates.length, stocks:stocks.sort((a,b)=>Math.abs(b.program)-Math.abs(a.program) || Math.abs(b.foreign+b.institution)-Math.abs(a.foreign+a.institution)) };
  }
  async marketOverview(market = "KOSPI") {
    if (market === "NASDAQ") return this.usOverview();
    const kosdaq = market === "KOSDAQ";
    const indexBody = await this.get(
        "/uapi/domestic-stock/v1/quotations/inquire-index-price",
        "FHPUP02100000",
        { FID_COND_MRKT_DIV_CODE: "U", FID_INPUT_ISCD: kosdaq ? "1001" : "0001" },
      ),
      rawIndex = indexBody.output ?? {},
      leaders = [];
    for (const [code, name] of (kosdaq ? [
      ["080220", "제주반도체"],
      ["086520", "에코프로"],
    ] : [
      ["005930", "삼성전자"],
      ["000660", "SK하이닉스"],
    ])) {
      const [priceBody, estimateBody, programBody] = await Promise.all([
          this.get(
            "/uapi/domestic-stock/v1/quotations/inquire-price",
            "FHKST01010100",
            { FID_COND_MRKT_DIV_CODE: "UN", FID_INPUT_ISCD: code },
          ),
          this.get(
            "/uapi/domestic-stock/v1/quotations/investor-trend-estimate",
            "HHPTJ04160200",
            { MKSC_SHRN_ISCD: code },
          ).catch(() => ({ output: [] })),
          this.get(
            "/uapi/domestic-stock/v1/quotations/program-trade-by-stock",
            "FHPPG04650101",
            { FID_COND_MRKT_DIV_CODE: "UN", FID_INPUT_ISCD: code },
          ).catch(() => ({ output: [] })),
        ]),
        price = normalizePrice(priceBody.output ?? {}),
        estimate = normalizeInvestorEstimate(estimateBody.output2 ?? []),
        stockProgram = programBody.output?.[0] ?? {};
      leaders.push({
        code,
        name,
        ...price,
        personal: 0,
        personalAvailable: false,
        ...estimate,
        program: normalizeNumber(stockProgram.whol_smtn_ntby_tr_pbmn) / 1000000,
      });
    }
    return {
      index: {
        price: normalizeNumber(rawIndex.bstp_nmix_prpr),
        changeRate: normalizeNumber(rawIndex.bstp_nmix_prdy_ctrt),
        twentyDay: 0,
        advancing: normalizeNumber(rawIndex.ascn_issu_cnt),
        declining: normalizeNumber(rawIndex.down_issu_cnt),
      },
      leaders,
    };
  }
  async usOverview() {
    const indices = [];
    for (const [code, name] of [["COMP", "NASDAQ"], ["SPX", "S&P 500"], [".DJI", "DOW"]]) {
      const body = await this.get(
          "/uapi/overseas-price/v1/quotations/inquire-time-indexchartprice",
          "FHKST03030200",
          { FID_COND_MRKT_DIV_CODE: "N", FID_INPUT_ISCD: code, FID_HOUR_CLS_CODE: "0", FID_PW_DATA_INCU_YN: "Y" },
        ),
        current = body.output1 ?? {};
      const latestDate = body.output2?.[0]?.stck_bsop_date,
        minutePoints = (body.output2 ?? []).filter((row) => !latestDate || row.stck_bsop_date === latestDate).map((row) => ({
        time: `${String(row.stck_cntg_hour).slice(0, 2)}:${String(row.stck_cntg_hour).slice(2, 4)}`,
        value: normalizeNumber(row.optn_prpr),
      })).filter((point) => point.value > 0).reverse();
      const openingPrice = normalizeNumber(current.ovrs_prod_oprc);
      if (openingPrice && minutePoints[0]?.time !== "09:30") minutePoints.unshift({ time: "09:30", value: openingPrice });
      indices.push({
        code,
        name,
        price: normalizeNumber(current.ovrs_nmix_prpr),
        changeRate: normalizeNumber(current.prdy_ctrt),
        points: minutePoints.filter((point, index) => Number(point.time.slice(3)) % 5 === 0 || index === minutePoints.length - 1),
      });
    }
    const leaders = [];
    for (const [exchange, code, name, reutersCode] of [["AMS", "SOXL", "SOXL", "SOXL.A"], ["AMS", "KORU", "KORU", "KORU.A"], ["NAS", "MU", "Micron", "MU.O"], ["NAS", "SNDK", "SanDisk", "SNDK.O"], ["NAS", "SKHY", "SK hynix ADR", "SKHY.O"]]) {
      try { const body = await this.get(
        "/uapi/overseas-price/v1/quotations/price",
        "HHDFS00000300",
        { AUTH: "", EXCD: exchange, SYMB: code },
      ), history = isUsPreMarket() ? await this.get("/uapi/overseas-price/v1/quotations/dailyprice", "HHDFS76240000", { AUTH: "", EXCD: exchange, SYMB: code, GUBN: "", BYMD: "", MODP: "0", KEYB: "" }) : null,
        regular = history ? normalizePreMarketOverseasPrice(body.output ?? {}, history.output2 ?? []) : normalizeOverseasPrice(body.output ?? {}), preMarket = history ? { preMarketPrice: regular.preMarketPrice, preMarketChangeRate: regular.preMarketChangeRate } : await fetch(`https://polling.finance.naver.com/api/realtime/worldstock/stock/${reutersCode}`)
          .then((response) => response.ok ? response.json() : Promise.reject())
          .then((payload) => normalizePreMarket(payload.datas?.[0] ?? {}, regular.price))
          .catch(() => null);
      leaders.push({ code, name, ...regular, ...preMarket, personal: 0, foreign: 0, institution: 0, program: 0 });
      } catch (error) { console.error(`[NASDAQ ${code}]`, error?.message ?? error); }
    }
    const end = new Date(), start = new Date(end);
    start.setDate(start.getDate() - 10);
    const iso = (date) => date.toISOString().slice(0, 10),
      forex = await fetch(`https://api.frankfurter.app/${iso(start)}..${iso(end)}?from=USD&to=KRW,JPY`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body) => {
        const rows = Object.entries(body.rates ?? {}).sort(([a], [b]) => a.localeCompare(b)),
          [date, latest] = rows.at(-1) ?? ["", {}],
          previous = rows.at(-2)?.[1] ?? latest,
          yen = (rates) => rates.JPY ? normalizeNumber(rates.KRW) / normalizeNumber(rates.JPY) * 100 : 0;
        return {
          date,
          usdKrw: normalizeNumber(latest.KRW),
          usdChange: normalizeNumber(latest.KRW) - normalizeNumber(previous.KRW),
          jpyKrw: yen(latest),
          jpyChange: yen(latest) - yen(previous),
        };
      })
      .catch(() => null);
    return { indices, leaders, forex };
  }
}
