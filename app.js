
const app=document.querySelector('#app');
let code=localStorage.getItem('auctionCode')||'';
let token=localStorage.getItem('auctionToken')||'';
let state=null,error='',busy=false,lastSignature='';
let selectedTopic='Ev Eşyaları';
let customTitle='',customItems='';
let bidDraft='';

const fmt=n=>new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0}).format(Number(n)||0)+' TL';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const box=x=>`<div class="glass">${x}</div>`;
const notice=()=>error?`<div class="notice">${esc(error)}</div>`:'';

async function api(action,extra={}){
 const r=await fetch('/api',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action,code,token,...extra})
 });
 const d=await r.json();
 if(!r.ok)throw Error(d.error||'İşlem başarısız.');
 return d;
}

async function perform(action,extra={}){
 if(busy)return;
 busy=true;
 try{
  const d=await api(action,extra);
  if(d.code&&d.token){
   code=d.code;
   token=d.token;
   localStorage.setItem('auctionCode',code);
   localStorage.setItem('auctionToken',token);
  }
  if(d.state){
   state=d.state;
   lastSignature=JSON.stringify(state);
  }
  error='';
  render();
 }catch(e){
  error=e.message;
  render();
 }finally{
  busy=false;
 }
}

function leave(){
 code='';token='';state=null;error='';lastSignature='';
 localStorage.removeItem('auctionCode');
 localStorage.removeItem('auctionToken');
 render();
}

function playerCard(p){
 const inventory=(p.items||[]).map(i=>`<span title="${fmt(i.paid)}">📦 ${esc(i.name)} (${fmt(i.paid)})</span>`).join('');
 const leading=state.status==='bidding'&&p.id===state.highestBidderId;
 return `<div class="player ${p.id===state.meId?'me':''}">
  <div class="name">${esc(p.name)} ${p.id===state.meId?'• Sen':''} ${leading?'🏆':''}</div>
  <div class="balance">${fmt(p.balance)}</div>
  <div class="muted" style="font-size:12px">${p.items.length} ürün satın aldı</div>
  <div class="inventory">${inventory||'<span>Henüz ürün yok</span>'}</div>
 </div>`;
}

function renderHome(){
 app.innerHTML=`
 <section class="hero">
  <div class="eyebrow">Arkadaşlarınla canlı açık artırma</div>
  <h1>Son Teklif<br>Kazanır!</h1>
  <p>Herkes 20 TL ile başlar. Konunu seç, teklif ver ve ürünleri topla.</p>
 </section>
 <div class="home-grid">
 ${box(`<h2 class="sectiontitle">🏠 Oda oluştur</h2>
  <form id="create">
   <label class="field">Oyuncu adın<input name="name" maxlength="22" required placeholder="Adını yaz"></label>
   <div class="info center"><strong>Başlangıç bütçesi: 20 TL</strong><br>Her oyuncu aynı bütçeyle başlar.</div>
   <button class="btn">Oda oluştur</button>
  </form>`)}
 ${box(`<h2 class="sectiontitle">🚪 Odaya katıl</h2>
  <form id="join">
   <label class="field">Oyuncu adın<input name="name" maxlength="22" required placeholder="Adını yaz"></label>
   <label class="field">Oda kodu<input name="code" maxlength="6" required placeholder="A1B2C3" style="text-transform:uppercase"></label>
   <button class="btn secondary">Odaya katıl</button>
  </form>`)}
 </div>${notice()}`;
 document.querySelector('#create').onsubmit=e=>{
  e.preventDefault();
  perform('create',{name:new FormData(e.target).get('name')});
 };
 document.querySelector('#join').onsubmit=e=>{
  e.preventDefault();
  const f=new FormData(e.target);
  code=String(f.get('code')).trim().toUpperCase();
  perform('join',{name:f.get('name')});
 };
}

function renderLobby(host){
 const topics=state.topics||[];
 const options=[...topics,'Özel Konu'].map(t=>`<option value="${esc(t)}" ${selectedTopic===t?'selected':''}>${esc(t)}</option>`).join('');
 const setup=host?`
  <h3>🎯 Açık artırma konusu</h3>
  <label class="field">Konu seç
   <select id="topic">${options}</select>
  </label>
  <div id="customFields" style="${selectedTopic==='Özel Konu'?'':'display:none'}">
   <label class="field">Özel konu adı
    <input id="customTitle" maxlength="60" placeholder="Örn. Futbolcular" value="${esc(customTitle)}">
   </label>
   <label class="field">Ürünler (her satıra bir ürün)
    <textarea id="customItems" rows="8" placeholder="Messi&#10;Ronaldo&#10;Neymar">${esc(customItems)}</textarea>
   </label>
   <p class="hint">Ürünleri alt alta yaz. Açık artırmada yalnızca bu ürünler çıkacak.</p>
  </div>
  <button class="btn secondary" id="saveTopic">Konuyu kaydet</button>
  <button class="btn" id="start" ${state.players.length<2?'disabled':''}>Oyunu başlat</button>
 `:`<div class="info center">Oda sahibinin konuyu seçip oyunu başlatması bekleniyor.</div>`;

 app.innerHTML=`
 ${box(`<div class="center">
  <div class="eyebrow">ODA KODU</div>
  <div class="room-code">${esc(state.code)}</div>
  <button class="btn secondary small" id="copy">Kodu kopyala</button>
  <p class="muted">Seçilen konu: <strong>${esc(state.topic)}</strong></p>
  <p>💰 Her oyuncu 20 TL ile başlar.</p>
 </div>
 <h3>Oyuncular (${state.players.length}/6)</h3>
 <div class="scoreboard">${state.players.map(playerCard).join('')}</div>
 ${setup}`)}`;
 document.querySelector('#copy').onclick=async()=>{
  try{
   await navigator.clipboard.writeText(state.code);
   document.querySelector('#copy').textContent='✓ Kopyalandı';
  }catch(e){error='Oda kodu: '+state.code;render();}
 };
 if(!host)return;
 document.querySelector('#topic').onchange=e=>{
  selectedTopic=e.target.value;
  document.querySelector('#customFields').style.display=selectedTopic==='Özel Konu'?'':'none';
 };
 document.querySelector('#customTitle').addEventListener('input',e=>customTitle=e.target.value);
 document.querySelector('#customItems').addEventListener('input',e=>customItems=e.target.value);
 const save=()=>perform('configure',{
  topic:selectedTopic,customTitle,customItems
 });
 document.querySelector('#saveTopic').onclick=save;
 document.querySelector('#start').onclick=async()=>{
  if(busy)return;
  busy=true;
  try{
   await api('configure',{topic:selectedTopic,customTitle,customItems});
   const d=await api('start');
   state=d.state;
   lastSignature=JSON.stringify(state);
   error='';
   render();
  }catch(e){error=e.message;render();}
  finally{busy=false;}
 };
}

function renderBidding(host,me){
 const it=state.item;
 const highest=Number(state.highestBid)||0;
 const leader=state.highestBidderName||'Henüz teklif yok';
 const isLeader=state.highestBidderId===state.meId;
 const canBid=me.balance>highest&&!isLeader;
 const min=highest+1;

 const bidArea=canBid?`
  <form id="bidform">
   <label class="field">Teklifin (TL)
    <input id="bidAmount" class="bidinput" name="amount" type="number" min="${min}" max="${me.balance}" step="1" value="${bidDraft&&Number(bidDraft)>=min&&Number(bidDraft)<=me.balance?esc(bidDraft):min}" required>
   </label>
   <button class="btn">🔨 Teklif ver</button>
  </form>`:
  `<div class="info center">${isLeader?'🏆 En yüksek teklif şu anda sende.':'Bu ürün için teklif veremiyorsun.'}</div>`;

 app.innerHTML=`
 <div class="topline">
  <div class="eyebrow">AÇIK ARTIRMA ${state.auctionIndex+1} / ${state.auctionTotal}</div>
  <div class="status">${esc(state.topic)}</div>
 </div>
 ${box(`<div class="product">
  <div class="product-emoji">📦</div>
  <div>
   <div class="tag">SATIŞTAKİ ÜRÜN</div>
   <h2>${esc(it.name)}</h2>
   <div class="info center">
    <div class="muted">🏆 En yüksek teklif</div>
    <div class="price">${fmt(highest)}</div>
    <div class="winner">${esc(leader)}</div>
   </div>
   <div class="info">💰 Kalan bütçen: <strong>${fmt(me.balance)}</strong></div>
   ${bidArea}
   ${host?`<button id="closeAuction" class="btn secondary">🔒 Satışı kapat ${highest===0?'(teklif yok)':''}</button>`:`<p class="hint center">Satışı oda sahibi kapatacak.</p>`}
  </div>
 </div>`)}
 <h3>Oyuncular</h3>
 <div class="scoreboard">${state.players.map(playerCard).join('')}</div>`;

 document.querySelector('#bidAmount')?.addEventListener('input',e=>bidDraft=e.target.value);
 document.querySelector('#bidform')?.addEventListener('submit',e=>{
  e.preventDefault();
  perform('bid',{amount:Number(new FormData(e.target).get('amount'))});
 });
 document.querySelector('#closeAuction')?.addEventListener('click',()=>{
  if(confirm('Bu ürünün açık artırmasını kapatmak istiyor musun?'))perform('close');
 });
}

function renderResult(host){
 const r=state.lastResult;
 app.innerHTML=`
 ${box(`<div class="center">
  <div class="eyebrow">AÇIK ARTIRMA TAMAMLANDI</div>
  <div style="font-size:65px">🔨</div>
  <h2>${esc(r.item.name)}</h2>
  <div class="muted">${r.winnerName?'Kazanan':'Ürün satılmadı'}</div>
  <div class="winner">${esc(r.winnerName||'Teklif verilmedi')}</div>
  <div class="price">${fmt(r.price)}</div>
  ${host?`<button id="next" class="btn">Sonraki ürüne geç →</button>`:`<div class="info">Oda sahibi bekleniyor.</div>`}
 </div>`)}
 <h3>Oyuncular</h3>
 <div class="scoreboard">${state.players.map(playerCard).join('')}</div>`;
 document.querySelector('#next')?.addEventListener('click',()=>{bidDraft='';perform('next');});
}

function renderFinished(){
 const standings=[...state.players].map(p=>({
  ...p,spent:20-p.balance,
  total:p.items.length
 })).sort((a,b)=>b.total-a.total||b.balance-a.balance);
 app.innerHTML=`
 ${box(`<div class="center">
  <div class="eyebrow">OYUN TAMAMLANDI</div>
  <div style="font-size:70px">🏆</div>
  <h2>Sonuçlar</h2>
  ${standings.map((p,i)=>`<div class="resultrow">
   <span>${i+1}. ${esc(p.name)}</span>
   <strong>${p.total} ürün</strong>
  </div><div class="muted">${fmt(p.spent)} harcadı · ${fmt(p.balance)} kaldı</div>`).join('')}
  <button id="newgame" class="btn secondary">Yeni oyun</button>
 </div>`)}
 <div class="scoreboard">${state.players.map(playerCard).join('')}</div>`;
 document.querySelector('#newgame').onclick=leave;
}

function render(){
 if(!state){renderHome();return;}
 const host=state.hostId===state.meId;
 const me=state.players.find(p=>p.id===state.meId);
 const header=`<div class="topline">
  <div><div class="tag">ODA ${esc(state.code)}</div>
  <div class="status">${state.players.length} oyuncu · 20 TL bütçe</div></div>
  <button class="btn secondary small" id="leave">Çıkış</button>
 </div>`;
 app.innerHTML=header+'<div id="gameBody"></div>';
 const target=document.querySelector('#gameBody');
 const oldApp=app;
 // Ekran içeriğini oluştur, ardından ortak başlığı koru.
 if(state.status==='lobby')renderLobby(host);
 else if(state.status==='bidding')renderBidding(host,me);
 else if(state.status==='result')renderResult(host);
 else if(state.status==='finished')renderFinished();
 else app.innerHTML='<div class="info">Oyun durumu bekleniyor.</div>';
 const content=app.innerHTML;
 app.innerHTML=header+content+notice();
 document.querySelector('#leave').onclick=leave;
 // innerHTML değişiminden sonra olayları yeniden bağla.
 bindEvents(host,me);
}

function bindEvents(host,me){
 if(state.status==='lobby'){
  document.querySelector('#copy')?.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(state.code);document.querySelector('#copy').textContent='✓ Kopyalandı';}
   catch(e){error='Kod: '+state.code;render();}
  });
  document.querySelector('#topic')?.addEventListener('change',e=>{
   selectedTopic=e.target.value;
   document.querySelector('#customFields').style.display=selectedTopic==='Özel Konu'?'':'none';
  });
  document.querySelector('#customTitle')?.addEventListener('input',e=>customTitle=e.target.value);
  document.querySelector('#customItems')?.addEventListener('input',e=>customItems=e.target.value);
  document.querySelector('#saveTopic')?.addEventListener('click',()=>perform('configure',{topic:selectedTopic,customTitle,customItems}));
  document.querySelector('#start')?.addEventListener('click',async()=>{
   if(busy)return;
   busy=true;
   try{
    await api('configure',{topic:selectedTopic,customTitle,customItems});
    const d=await api('start');
    state=d.state;lastSignature=JSON.stringify(state);error='';render();
   }catch(e){error=e.message;render();}
   finally{busy=false;}
  });
 }
 if(state.status==='bidding'){
  document.querySelector('#bidAmount')?.addEventListener('input',e=>bidDraft=e.target.value);
  document.querySelector('#bidform')?.addEventListener('submit',e=>{
   e.preventDefault();perform('bid',{amount:Number(new FormData(e.target).get('amount'))});
  });
  document.querySelector('#closeAuction')?.addEventListener('click',()=>{
   if(confirm('Satışı kapatmak istiyor musun?'))perform('close');
  });
 }
 if(state.status==='result')
  document.querySelector('#next')?.addEventListener('click',()=>{bidDraft='';perform('next');});
 if(state.status==='finished')
  document.querySelector('#newgame')?.addEventListener('click',leave);
}

async function poll(){
 if(!code||!token||busy)return;
 try{
  const d=await api('state');
  const sig=JSON.stringify(d.state);
  if(sig!==lastSignature){
   lastSignature=sig;state=d.state;error='';
   // Kullanıcı yazarken formu gereksiz yenileme.
   const active=document.activeElement;
   const editing=active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
   if(!editing)render();
  }
 }catch(e){
  if(state){
   error='Bağlantı kesildi. Yeniden deneniyor…';
   render();
  }else{
   leave();
  }
 }
}
render();
if(code&&token)poll();
setInterval(poll,1300);
