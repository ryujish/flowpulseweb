const kstMinutes=(date=new Date())=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date),get=type=>parts.find(part=>part.type===type)?.value;return {weekday:get("weekday"),minutes:Number(get("hour"))*60+Number(get("minute"))}};

export function candidatePhase(date=new Date()) {
  const {weekday,minutes}=kstMinutes(date);
  if (["Sat","Sun"].includes(weekday)) return {id:"FPA",title:"종목 추천",status:"휴장 · 마지막 정상 후보",recommended:true};
  if (minutes<480||minutes>=545) return {id:"FPA",title:"종목 추천",status:"추세형·반전형 추천",recommended:true};
  if (minutes<495) return {id:"OPA_EARLY",title:"프리마켓 탐색",status:"데이터 축적 중",recommended:false};
  if (minutes<530) return {id:"OPA_NXT",title:"프리마켓 관심 종목",status:"NXT 강세",recommended:false};
  if (minutes<540) return {id:"OPA_OPEN",title:"개장 예상 후보",status:"KRX 시가 확인",recommended:false};
  return {id:"OPEN_VERIFY",title:"개장 검증",status:"본장 확인 중",recommended:false};
}

const percentile=(value,rows,key)=>{const values=rows.map(key).filter(Number.isFinite).sort((a,b)=>a-b),rank=values.findLastIndex(item=>item<=value);return values.length<2?50:Math.round(rank/(values.length-1)*100)},
  gapScore=gap=>gap<-1?20:gap<0?40:gap<=1?80:gap<=3?100:gap<=5?60:20,
  clamp=value=>Math.round(Math.max(0,Math.min(100,value)));

export function selectOpeningCandidates(stocks,history,now=Date.now()) {
  const phase=candidatePhase(new Date(now)),rows=stocks.map(stock=>{
    const points=[...(history.get(stock.code)??[]),{at:now,value:stock.program,nxtPrice:stock.nxtPrice,auctionPrice:stock.auctionPrice,auctionVolume:stock.auctionVolume}].filter(point=>point.at>=now-15*60000);
    history.set(stock.code,points);
    const prevClose=stock.nxtPrice&&Number.isFinite(stock.nxtChangeRate)?stock.nxtPrice/(1+stock.nxtChangeRate/100):stock.price/(1+stock.changeRate/100),
      nxtGap=prevClose&&stock.nxtPrice?(stock.nxtPrice/prevClose-1)*100:null,
      auctionGap=prevClose&&stock.auctionPrice?(stock.auctionPrice/prevClose-1)*100:null,
      prior=points.find(point=>point.at<=now-60000),
      auctionAcceleration=prior?.auctionVolume&&stock.auctionVolume?(stock.auctionVolume/prior.auctionVolume-1)*100:null;
    return {...stock,prevClose,nxtGap,auctionGap,auctionAcceleration};
  });
  return rows.map(stock=>{
    const nxtAvailable=stock.nxtGap!==null,nxtRs=percentile(stock.nxtGap??-99,rows,row=>row.nxtGap??-99),volumeQuality=percentile(stock.nxtAmount??0,rows,row=>row.nxtAmount??0),
      orderPressure=stock.nxtBidQuantity||stock.nxtAskQuantity?100*stock.nxtBidQuantity/Math.max(1,stock.nxtBidQuantity+stock.nxtAskQuantity):50,
      persistence=stock.nxtGap!==null&&stock.nxtGap>=0?100:0,
      nxtScore=nxtAvailable?clamp(.25*gapScore(stock.nxtGap)+.25*nxtRs+.20*volumeQuality+.15*orderPressure+.15*persistence):null,
      flowQuality=percentile(stock.program+stock.foreign*stock.price/1000000+stock.institution*stock.price/1000000,rows,row=>row.program+row.foreign*row.price/1000000+row.institution*row.price/1000000),
      prevScore=clamp(.30*percentile(stock.changeRate,rows,row=>row.changeRate)+.25*50+.20*flowQuality+.15*percentile(stock.volumeRatio,rows,row=>row.volumeRatio)+.10*50),
      liquidityScore=percentile(stock.nxtAmount??stock.amount,rows,row=>row.nxtAmount??row.amount),
      auctionAvailable=stock.auctionGap!==null,
      auctionScore=auctionAvailable?clamp(.35*gapScore(stock.auctionGap)+.30*Math.min(100,50+Math.max(-50,stock.auctionAcceleration??0))+.20*80+.15*(Math.sign(stock.auctionGap)===Math.sign(stock.nxtGap??0)?100:0)):null,
      venueGap=stock.nxtPrice&&stock.auctionPrice?Math.abs(stock.nxtPrice-stock.auctionPrice)/stock.prevClose*100:null,
      venueAgreement=venueGap===null?null:clamp(100-venueGap*50),
      riskPenalty=(stock.nxtSpread>0.5?10:0)+((stock.nxtGap??0)>=5?10:0)+((stock.nxtGap??0)>=10?10:0)+(venueGap!==null&&venueGap>1.5?10:0)+(stock.nxtGap!==null&&stock.auctionGap!==null&&Math.sign(stock.nxtGap)!==Math.sign(stock.auctionGap)?15:0),
      weights=phase.id==="OPA_EARLY"?[[prevScore,.55],[nxtScore,.45]]:["OPA_OPEN","OPEN_VERIFY"].includes(phase.id)?[[nxtScore,.35],[auctionScore,.35],[venueAgreement,.15],[prevScore,.10],[liquidityScore,.05]]:[[nxtScore,.60],[prevScore,.30],[liquidityScore,.10]],
      usable=weights.filter(([score])=>score!==null),opaScore=clamp(usable.reduce((sum,[score,weight])=>sum+score*weight,0)/Math.max(.01,usable.reduce((sum,[,weight])=>sum+weight,0))-riskPenalty),
      dataConfidence=clamp(100*usable.reduce((sum,[,weight])=>sum+weight,0)),
      openingReady=phase.id==="OPA_OPEN"&&opaScore>=75&&(nxtScore??0)>=60&&(auctionScore??0)>=65&&(venueGap??99)<=1.5&&riskPenalty<20&&dataConfidence>=75;
    return {...stock,algorithm:"OPA",opaScore,nxtScore,prevScore,auctionScore,venueAgreement,venueGap,riskPenalty,liquidityScore,dataConfidence,recommended:false,grade:phase.id==="OPA_EARLY"?"데이터 축적 중":phase.id==="OPEN_VERIFY"?"본장 확인 중":openingReady?"개장 예상 후보":opaScore>=70?"프리마켓 관심":"관찰",playbook:"OPA",strategies:["OPA"]};
  }).filter(stock=>stock.opaScore>=60).sort((a,b)=>b.opaScore-a.opaScore);
}
