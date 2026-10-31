'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const rooms = new Map();
const MAX_PLAYERS = 6;
const ITEMS = [
 ['🧊','Buzdolabı',30000],['📺','Televizyon',25000],['🛋️','Koltuk Takımı',35000],['🧺','Çamaşır Makinesi',22000],['🍽️','Bulaşık Makinesi',19000],
 ['🛏️','Yatak',24000],['🔥','Fırın',18000],['☕','Kahve Makinesi',12000],['🧹','Robot Süpürge',21000],['❄️','Klima',28000],
 ['🪑','Yemek Masası',16000],['💻','Laptop',32000],['📱','Telefon',37000],['🎮','Oyun Konsolu',27000],['🎧','Kulaklık',7500],
 ['📽️','Projeksiyon',17000],['🍳','Airfryer',8500],['🥤','Blender',5500],['🧼','Kurutma Makinesi',24000],['💡','Akıllı Aydınlatma',6500],
 ['🪞','Boy Aynası',5000],['🪴','Salon Bitkisi',3500],['🧯','Güvenlik Seti',4500],['🪟','Perde Takımı',7500],['🧸','Dekor Seti',6000],
 ['🚲','Bisiklet',16500],['📷','Fotoğraf Makinesi',29000],['⌚','Akıllı Saat',14500],['🔊','Ses Sistemi',16000],['🧥','Gardırop',20500],
 ['🧊','Derin Dondurucu',15500],['🍞','Ekmek Makinesi',4000],['🪟','Çalışma Masası',12500],['🛁','Banyo Dolabı',10000],['🧽','Elektrikli Süpürge',13000],
 ['🪭','Vantilatör',4200],['📚','Kitaplık',8500],['🪑','Ofis Koltuğu',11500],['🧃','Meyve Sıkacağı',6200],['📡','Modem',3800]
];
const uid = () => crypto.randomBytes(18).toString('hex');
const send = (res, status, data) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data)); };
const shuffle = (a) => {a=[...a];for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function publicRoom(room, token){
 const me = room.players.find(p=>p.token===token);
 const active = room.status==='bidding' ? room.players.filter(p=>p.items.length<5):[];
 return {code:room.code,status:room.status,hostId:room.hostId,meId:me?.id||null,budget:room.budget,auctionIndex:room.index,auctionTotal:room.players.length*5,
 players:room.players.map(p=>({id:p.id,name:p.name,balance:p.balance,items:p.items,submitted:room.status==='bidding' && Object.prototype.hasOwnProperty.call(room.bids,p.id),eligible:p.items.length<5})),
 item:room.status==='bidding'?room.deck[room.index]:null,activeCount:active.length,submittedCount:active.filter(p=>Object.prototype.hasOwnProperty.call(room.bids,p.id)).length,
 myBid: me && Object.prototype.hasOwnProperty.call(room.bids,me.id)?room.bids[me.id]:null,
 lastResult:room.lastResult,history:room.history};
}
function handleApi(req,res,body){
 const {action,code,token}=body;
 if(action==='create'){
  const name=String(body.name||'').trim().slice(0,22),budget=Number(body.budget);
  if(!name || !Number.isInteger(budget)||budget<1000||budget>10000000)return send(res,400,{error:'Geçerli isim ve 1.000–10.000.000 TL bütçe gir.'});
  let roomCode;do{roomCode=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(roomCode));
  const player={id:uid(),token:uid(),name,balance:budget,items:[]};
  rooms.set(roomCode,{code:roomCode,status:'lobby',hostId:player.id,budget,players:[player],deck:[],index:0,bids:{},lastResult:null,history:[],createdAt:Date.now()});
  return send(res,200,{code:roomCode,token:player.token,state:publicRoom(rooms.get(roomCode),player.token)});
 }
 const room=rooms.get(String(code||'').trim().toUpperCase());
 if(!room)return send(res,404,{error:'Oda bulunamadı. Kodunu kontrol et.'});
 if(action==='join'){
  if(room.status!=='lobby')return send(res,409,{error:'Oyun başladı, yeni oyuncu katılamaz.'});
  if(room.players.length>=MAX_PLAYERS)return send(res,409,{error:'Oda dolu (en fazla 6 kişi).'});
  const name=String(body.name||'').trim().slice(0,22);
  if(!name)return send(res,400,{error:'Oyuncu adı gir.'});
  if(room.players.some(p=>p.name.toLocaleLowerCase('tr')===name.toLocaleLowerCase('tr')))return send(res,409,{error:'Bu oyuncu adı zaten kullanılıyor.'});
  const p={id:uid(),token:uid(),name,balance:room.budget,items:[]};room.players.push(p);
  return send(res,200,{code:room.code,token:p.token,state:publicRoom(room,p.token)});
 }
 const p=room.players.find(p=>p.token===token);
 if(!p)return send(res,403,{error:'Bu odaya erişim yetkin yok.'});
 if(action==='state')return send(res,200,{state:publicRoom(room,token)});
 if(action==='start'){
  if(p.id!==room.hostId)return send(res,403,{error:'Oyunu sadece oda sahibi başlatabilir.'});
  if(room.status!=='lobby'||room.players.length<2)return send(res,409,{error:'Başlamak için en az 2 oyuncu gerekiyor.'});
  room.deck=shuffle(ITEMS).slice(0,room.players.length*5).map((it,i)=>({id:i,emoji:it[0],name:it[1],value:it[2]}));
  room.status='bidding';return send(res,200,{state:publicRoom(room,token)});
 }
 if(action==='bid'){
  if(room.status!=='bidding')return send(res,409,{error:'Şu anda teklif verilemiyor.'});
  if(p.items.length>=5)return send(res,409,{error:'5 eşyanı tamamladın.'});
  if(Object.prototype.hasOwnProperty.call(room.bids,p.id))return send(res,409,{error:'Bu ürün için teklifini verdin.'});
  const amount=Number(body.amount);
  if(!Number.isSafeInteger(amount)||amount<0||amount>p.balance)return send(res,400,{error:'Teklif 0 ile kalan bütçen arasında tam sayı olmalı.'});
  room.bids[p.id]=amount;
  const eligible=room.players.filter(x=>x.items.length<5);
  if(eligible.every(x=>Object.prototype.hasOwnProperty.call(room.bids,x.id))){
   const highest=Math.max(...eligible.map(x=>room.bids[x.id]));
   const ties=eligible.filter(x=>room.bids[x.id]===highest);
   const winner=ties[crypto.randomInt(ties.length)];
   const item=room.deck[room.index];winner.balance-=highest;winner.items.push({...item,paid:highest});
   room.lastResult={item,winnerId:winner.id,winnerName:winner.name,price:highest,tied:ties.length>1,bids:eligible.map(x=>({id:x.id,name:x.name,amount:room.bids[x.id]})).sort((a,b)=>b.amount-a.amount)};
   room.history.push(room.lastResult);room.status='result';
  }
  return send(res,200,{state:publicRoom(room,token)});
 }
 if(action==='next'){
  if(p.id!==room.hostId)return send(res,403,{error:'Sıradaki ürünü yalnızca oda sahibi açabilir.'});
  if(room.status!=='result')return send(res,409,{error:'Önce mevcut açık artırma bitsin.'});
  room.index++;room.bids={};room.status=room.index>=room.deck.length?'finished':'bidding';
  return send(res,200,{state:publicRoom(room,token)});
 }
 return send(res,400,{error:'Bilinmeyen işlem.'});
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 if(req.url.startsWith('/api')){
  if(req.method!=='POST')return send(res,405,{error:'POST bekleniyor.'});
  let str='';req.on('data',x=>{str+=x;if(str.length>15000)req.destroy()});req.on('end',()=>{try{handleApi(req,res,JSON.parse(str||'{}'))}catch(e){console.error(e);send(res,400,{error:'İstek işlenemedi.'})}});return;
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end()}
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(ROOT,pathname==='/'?'index.html':pathname);
 if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,content)=>{if(err){res.writeHead(404);return res.end('Not found')};res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content)})
}).listen(PORT,'0.0.0.0',()=>console.log(`Açık artırma oyunu: http://localhost:${PORT}`));
setInterval(()=>{const now=Date.now();for(const [code,room] of rooms)if(now-room.createdAt>24*60*60*1000)rooms.delete(code)},3600000).unref();
