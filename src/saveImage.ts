export async function saveImage(url:string, name:string) {
  const file=new File([await fetch(url).then(response=>response.blob())],name,{type:"image/png"});
  if (navigator.canShare?.({files:[file]})) return navigator.share({files:[file],title:"FlowPulse 화면 저장"});
  const link=document.createElement("a");
  link.download=name;
  link.href=url;
  link.click();
}
