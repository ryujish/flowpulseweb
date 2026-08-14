export async function saveImage(url:string, name:string) {
  const bridge=(window as unknown as {flutter_inappwebview?:{callHandler:(name:string,payload:unknown)=>Promise<unknown>}}).flutter_inappwebview;
  if (bridge) { await bridge.callHandler("saveImage",{url,name}); return; }
  const file=new File([await fetch(url).then(response=>response.blob())],name,{type:"image/png"});
  if (navigator.canShare?.({files:[file]})) return navigator.share({files:[file],title:"FlowPulse 화면 저장"});
  const link=document.createElement("a");
  link.download=name;
  link.href=url;
  link.click();
}
