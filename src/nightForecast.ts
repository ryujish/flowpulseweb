import type { MarketFlow } from "./domain";

type Quote = NonNullable<MarketFlow["leaders"]>[number];
export type NightForecast = { rate:number; open:number; high:number; low:number; close:number };

export const isNightForecastTime = (date = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Seoul", hour:"2-digit", hourCycle:"h23" }).format(date));
  return hour >= 20 || hour < 8;
};

export const isMorningPreparationTime = (date = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone:"Asia/Seoul", hour:"2-digit", hourCycle:"h23" }).format(date));
  return hour >= 6 && hour < 8;
};

export function nightForecast(stock:Quote|undefined, us:MarketFlow|undefined, kind:"samsung"|"hynix"):NightForecast|null {
  if (!stock || !us) return null;
  const leader=(code:string)=>(us.leaders??[]).find(item=>item.code===code)?.changeRate,
    index=(code:string)=>(us.indices??[]).find(item=>item.code===code)?.changeRate,
    koru=leader("KORU"), soxl=leader("SOXL"), nasdaq=index("COMP"), mu=leader("MU"), sndk=leader("SNDK"), skhy=leader("SKHY");
  if ([koru,soxl,nasdaq].some(value=>value===undefined)) return null;
  const futures=koru!/3, sox=soxl!/3,
    micron=mu??sox, sandisk=sndk??sox, adr=skhy??sox,
    memory=(micron+sandisk+adr)/3,
    fx=us.forex?.usdKrw ? us.forex.usdChange/(us.forex.usdKrw-us.forex.usdChange)*100 : 0,
    pressure=kind==="samsung"
      ? .30*futures+.25*sox+.15*nasdaq!+.15*micron+.10*memory+.05*fx
      : .20*futures+.15*sox+.05*nasdaq!+.20*micron+.15*sandisk+.20*adr+.05*memory,
    overnight=kind==="samsung"
      ? .45*futures+.25*sox+.15*nasdaq!+.15*micron
      : .30*futures+.15*sox+.20*micron+.15*sandisk+.20*adr,
    previousRise=Math.max(0,stock.changeRate),
    preReflection=Math.min(.35,previousRise*(kind==="samsung"?.02:.025)),
    openRate=overnight*(1-preReflection*.65),
    profitTaking=Math.min(.2,Math.max(0,openRate-pressure)*.04+Math.max(0,previousRise-3)*.01),
    alpha=Math.max(0,memory-sox)*(kind==="samsung"?.03:.06),
    rate=pressure*(1-preReflection)*(1-profitTaking)+alpha,
    tick=stock.price>=500000?1000:stock.price>=200000?500:100,
    price=(change:number)=>Math.round(stock.price*(1+change/100)/tick)*tick,
    volatility=Math.max(.8,[futures,sox,nasdaq!,micron,sandisk,adr].reduce((sum,value)=>sum+Math.abs(value),0)/6*.18),
    momentum=Math.max(0,memory-sox),
    highRate=Math.max(openRate,rate)+volatility*.5+momentum*.15,
    lowRate=Math.min(openRate,rate)-volatility*.35;
  return {rate,open:price(openRate),high:price(highRate),low:price(lowRate),close:price(rate)};
}
