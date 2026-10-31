
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT||3000),ROOT=__dirname,rooms=new Map();
const TOPICS={
 'Ev Eşyaları':['Buzdolabı','Koltuk','Yatak','Televizyon','Çamaşır Makinesi','Fırın','Bulaşık Makinesi','Masa','Dolap','Klima','Robot Süpürge','Kahve Makinesi'],
 'Teknoloji':['iPhone','Laptop','Tablet','Oyun Konsolu','Kulaklık','Akıllı Saat','Kamera','Projektör','Drone','Monitör'],
 'Otomobil':['Spor Araba','SUV','Elektrikli Araba','Klasik Araba','Motosiklet','Karavan','Arazi Aracı','Lüks Sedan','Go-Kart','Tekne'],
 'Tatil':['Maldivler','Paris','Tokyo','Roma','Bali','Kapadokya','İsviçre','New York','Dubai','Santorini'],
 'Yemek':['Pizza','Burger','Sushi','Kebap','Mantı','Baklava','Dondurma','Lahmacun','Pasta','Taco']
};
const id=()=>crypto.randomBytes(16).toString('hex');
const reply=(res,status,data)=>{
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
 res.end(JSON.stringify(data));
};
const shuffle=a=>{
 a=[...a];
 for(let i=a.length-1;i>0;i--){
  const j=crypto.randomInt(i+1);
  [a[i],a[j]]=[a[j],a[i]];
 }
 return a;
};
function view(r,t){
 const me=r.players.find(p=>p.token===t);
 return {
  code:r.code,status:r.status,hostId:r.hostId,meId:me?.id||null,
  budget:20,topic:r.topic,topics:Object.keys(TOPICS),
  players:r.players.map(p=>({id:p.id,name:p.name,balance:p.balance,items:p.items})),
  item:r.status==='bidding'?r.deck[r.index]:null,
  auctionIndex:r.index,auctionTotal:r.deck.length,
  highestBid:r.highestBid,highestBidderId:r.highestBidderId,
  highestBidderName:r.players.find(p=>p.id===r.highestBidderId)?.name||null,
  lastResult:r.lastResult,history:r.history
 };
}
function api(res,b){
 const action=b.action;
 let r;
 if(action==='create'){
  const name=String(b.name||'').trim().slice(0,22);
  if(!name)return reply(res,400,{error:'İsim gir.'});
  let code;
  do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));
  const p={id:id(),token:id(),name,balance:20,items:[]};
  r={code,hostId:p.id,players:[p],status:'lobby',topic:'Ev Eşyaları',customItems:[],deck:[],index:0,highestBid:0,highestBidderId:null,lastResult:null,history:[],createdAt:Date.now()};
  rooms.set(code,r);
  return reply(res,200,{code,token:p.token,state:view(r,p.token)});
 }
 r=rooms.get(String(b.code||'').trim().toUpperCase());
 if(!r)return reply(res,404,{error:'Oda bulunamadı.'});
 if(action==='join'){
  if(r.status!=='lobby')return reply(res,409,{error:'Oyun başladı.'});
  if(r.players.length>=6)return reply(res,409,{error:'Oda dolu.'});
  const name=String(b.name||'').trim().slice(0,22);
  if(!name||r.players.some(p=>p.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))
   return reply(res,400,{error:'Farklı bir oyuncu adı gir.'});
  const p={id:id(),token:id(),name,balance:20,items:[]};
  r.players.push(p);
  return reply(res,200,{code:r.code,token:p.token,state:view(r,p.token)});
 }
 const p=r.players.find(x=>x.token===b.token);
 if(!p)return reply(res,403,{error:'Oturum geçersiz.'});
 if(action==='state')return reply(res,200,{state:view(r,p.token)});
 if(action==='configure'){
  if(p.id!==r.hostId||r.status!=='lobby')
   return reply(res,403,{error:'Yalnızca oda sahibi konu seçebilir.'});
  const topic=String(b.topic||'').trim().slice(0,60);
  if(topic==='Özel Konu'){
   const title=String(b.customTitle||'').trim().slice(0,60);
   const items=String(b.customItems||'').split(/\r?\n/).map(x=>x.trim().slice(0,70)).filter(Boolean).slice(0,100);
   if(!title||!items.length)return reply(res,400,{error:'Konu adı ve en az bir ürün gir.'});
   r.topic=title;r.customItems=items;
  }else{
   if(!TOPICS[topic])return reply(res,400,{error:'Konu seç.'});
   r.topic=topic;r.customItems=[];
  }
  return reply(res,200,{state:view(r,p.token)});
 }
 if(action==='start'){
  if(p.id!==r.hostId||r.status!=='lobby')
   return reply(res,403,{error:'Başlatma yetkin yok.'});
  if(r.players.length<2)return reply(res,400,{error:'En az 2 oyuncu gerekli.'});
  const list=r.customItems.length?r.customItems:TOPICS[r.topic];
  r.deck=shuffle(list).map((name,i)=>({id:i,name}));
  r.index=0;r.status='bidding';r.highestBid=0;r.highestBidderId=null;
  return reply(res,200,{state:view(r,p.token)});
 }
 if(action==='bid'){
  if(r.status!=='bidding')return reply(res,409,{error:'Teklifler kapalı.'});
  const amount=Number(b.amount);
  if(!Number.isInteger(amount)||amount<=r.highestBid||amount>p.balance)
   return reply(res,400,{error:`Teklif ${r.highestBid} TL üzerinde ve bütçen dahilinde olmalı.`});
  if(p.id===r.highestBidderId)return reply(res,409,{error:'Zaten en yüksek teklif sende.'});
  r.highestBid=amount;r.highestBidderId=p.id;
  return reply(res,200,{state:view(r,p.token)});
 }
 if(action==='close'){
  if(p.id!==r.hostId||r.status!=='bidding')
   return reply(res,403,{error:'Satışı yalnızca oda sahibi kapatabilir.'});
  const item=r.deck[r.index],winner=r.players.find(x=>x.id===r.highestBidderId);
  if(winner){
   winner.balance-=r.highestBid;
   winner.items.push({...item,paid:r.highestBid});
  }
  r.lastResult={item,winnerId:winner?.id||null,winnerName:winner?.name||null,price:winner?r.highestBid:0};
  r.history.push(r.lastResult);r.status='result';
  return reply(res,200,{state:view(r,p.token)});
 }
 if(action==='next'){
  if(p.id!==r.hostId||r.status!=='result')
   return reply(res,403,{error:'Sonraki ürünü oda sahibi açabilir.'});
  r.index++;r.highestBid=0;r.highestBidderId=null;
  r.status=r.index>=r.deck.length||r.players.every(x=>x.balance===0)?'finished':'bidding';
  return reply(res,200,{state:view(r,p.token)});
 }
 return reply(res,400,{error:'Bilinmeyen işlem.'});
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api'){
  if(req.method!=='POST')return reply(res,405,{error:'POST gerekli.'});
  let data='';
  req.on('data',chunk=>{data+=chunk;if(data.length>30000)req.destroy()});
  req.on('end',()=>{
   try{api(res,JSON.parse(data||'{}'))}
   catch(e){console.error(e);reply(res,400,{error:'İstek işlenemedi.'})}
  });
  return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 const file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
 if(file!==path.join(ROOT,'index.html')&&!file.startsWith(ROOT+path.sep)){
  res.writeHead(403);return res.end();
 }
 fs.readFile(file,(err,content)=>{
  if(err){res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(content);
 });
}).listen(PORT,'0.0.0.0',()=>console.log('Oyun çalışıyor: '+PORT));
setInterval(()=>{
 for(const [code,r] of rooms)
  if(Date.now()-r.createdAt>86400000)rooms.delete(code);
},3600000).unref();
