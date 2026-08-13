import assert from "node:assert/strict";
import { isMorningPreparationTime, isNightForecastTime, isUsExtendedMarketOpen, nightForecast } from "./nightForecast";

assert.equal(isNightForecastTime(new Date("2026-08-13T11:00:00Z")),true);
assert.equal(isNightForecastTime(new Date("2026-08-13T10:59:00Z")),false);
assert.equal(isNightForecastTime(new Date("2026-08-13T23:00:00Z")),false);
assert.equal(isUsExtendedMarketOpen(new Date("2026-08-13T23:59:00Z")),true);
assert.equal(isUsExtendedMarketOpen(new Date("2026-08-14T00:00:00Z")),false);
assert.equal(isMorningPreparationTime(new Date("2026-08-13T21:30:00Z")),true);
assert.equal(isMorningPreparationTime(new Date("2026-08-13T23:00:00Z")),false);
const stock={code:"005930",name:"삼성전자",price:268000,changeRate:0,twentyDay:0,personal:0,foreign:0,institution:0,program:0},
  us={live:true,source:"test",indices:[{code:"COMP",name:"NASDAQ",price:1,changeRate:.7,points:[]}],leaders:[{...stock,code:"KORU",changeRate:7.74},{...stock,code:"SOXL",changeRate:5.46},{...stock,code:"MU",changeRate:6},{...stock,code:"SNDK",changeRate:15}]};
assert.equal(nightForecast(stock,us,"samsung")?.close,276500);
assert.ok(nightForecast({...stock,changeRate:4.9},us,"samsung")!.close<nightForecast(stock,us,"samsung")!.close);
const hynix={...stock,code:"000660",name:"SK하이닉스",price:1593000}, withAdr={...us,leaders:[...us.leaders,{...stock,code:"SKHY",changeRate:8}]};
assert.ok(nightForecast(hynix,withAdr,"hynix")!.close!==nightForecast(hynix,us,"hynix")!.close);
const reflected={...stock,changeRate:4.9}, reflectedUs={...us,leaders:[...us.leaders,{...stock,code:"SKHY",changeRate:8}]};
assert.ok(nightForecast(reflected,reflectedUs,"samsung")!.rate>0);
assert.notEqual(nightForecast(stock,{...us,leaders:us.leaders.map(item=>item.code==="MU"?{...item,preMarketChangeRate:12}:item)},"samsung")!.close,nightForecast(stock,us,"samsung")!.close);
console.log("night forecast checks passed");
