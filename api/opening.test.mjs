import test from "node:test";
import assert from "node:assert/strict";
import { candidatePhase, selectOpeningCandidates } from "./opening.mjs";

test("08시부터 09시 05분까지 OPA 단계를 분리한다",()=>{
  assert.equal(candidatePhase(new Date("2026-08-13T23:05:00Z")).id,"OPA_EARLY");
  assert.equal(candidatePhase(new Date("2026-08-13T23:20:00Z")).id,"OPA_NXT");
  assert.equal(candidatePhase(new Date("2026-08-13T23:55:00Z")).id,"OPA_OPEN");
  assert.equal(candidatePhase(new Date("2026-08-14T00:03:00Z")).id,"OPEN_VERIFY");
  assert.equal(candidatePhase(new Date("2026-08-14T00:05:00Z")).id,"FPA");
});

test("OPA는 NXT 데이터가 없으면 가중치를 재분배하고 추천하지 않는다",()=>{
  const stock={code:"A",name:"A",market:"KOSPI",price:10000,changeRate:2,amount:10000000000,volumeRatio:150,program:10,foreign:10,institution:10,nxtPrice:null,nxtChangeRate:null,nxtAmount:0,nxtSpread:0,nxtAskQuantity:0,nxtBidQuantity:0,auctionPrice:null,auctionVolume:0};
  const result=selectOpeningCandidates([stock],new Map(),new Date("2026-08-13T23:20:00Z").getTime());
  assert.deepEqual(result,[]);
});
