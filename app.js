
'use strict';

const app = document.getElementById('app');
const API = '/api';
const ALPHABET = [...'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'];

let code = '';
let token = '';
let state = null;
let busy = false;
let screen = 'home';
let error = '';
let lastVersion = '';

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('hangman-session') || '{}');
  } catch {
    return {};
  }
})();

code = saved.code || '';
token = saved.token || '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

function saveSession() {
  localStorage.setItem('hangman-session', JSON.stringify({code,token}));
}

async function request(action, extra = {}) {
  const response = await fetch(API, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,code,token,...extra})
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Sunucu yanıt vermiyor.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'İşlem başarısız.');
  }

  return data;
}

async function perform(action, extra = {}) {
  if (busy) return;
  busy = true;
  error = '';

  try {
    const data = await request(action,extra);

    if (data.code) code = data.code;
    if (data.token) token = data.token;
    if (data.state) state = data.state;

    saveSession();
    render();
  } catch (e) {
    error = e.message;
    render();
  } finally {
    busy = false;
  }
}

function leave() {
  localStorage.removeItem('hangman-session');
  code = '';
  token = '';
  state = null;
  error = '';
  screen = 'home';
  render();
}

function notice() {
  return error ? `<div class="notice">${esc(error)}</div>` : '';
}

function scores() {
  const players = [...state.players].sort((a,b) => b.score-a.score);

  return `<div class="scoreboard">
    ${players.map(p => `
      <div class="player ${p.id===state.meId?'me':''}">
        <div class="name">${esc(p.name)} ${p.id===state.meId?'👤':''}</div>
        <div class="balance">⭐ ${p.score}</div>
      </div>
    `).join('')}
  </div>`;
}

function home() {
  return `
    ${notice()}
    <div class="card">
      <h2>🎮 Oda Oluştur</h2>
      <p class="muted">Arkadaşlarını davet et ve yarışmaya başla.</p>
      <form id="createForm">
        <label>Oyuncu adın
          <input name="name" maxlength="22" required placeholder="Adını yaz">
        </label>
        <button class="btn" type="submit">Yeni Oda Oluştur</button>
      </form>
    </div>
    <div class="card">
      <h2>🔑 Odaya Katıl</h2>
      <form id="joinForm">
        <label>Oyuncu adın
          <input name="name" maxlength="22" required placeholder="Adını yaz">
        </label>
        <label>Oda kodu
          <input name="roomCode" maxlength="6" required placeholder="ABC123"
            style="text-transform:uppercase">
        </label>
        <button class="btn secondary" type="submit">Odaya Katıl</button>
      </form>
    </div>
  `;
}

function lobby() {
  const host = state.meId === state.hostId;

  return `
    ${notice()}
    <div class="card center">
      <span class="tag">BEKLEME ODASI</span>
      <p class="muted">Arkadaşların bu kodla katılabilir.</p>
      <div class="room-code">${esc(state.code)}</div>
      <button class="small secondary" id="copyCode">📋 Kodu Kopyala</button>
      <p class="muted">${state.players.length}/6 oyuncu</p>
    </div>

    <div class="card">
      <h2>👥 Oyuncular</h2>
      ${scores()}
    </div>

    <div class="card">
      <h2>⚙️ Oyun Ayarları</h2>
      ${host ? `
        <form id="configForm">
          <label>Kategori
            <select name="category" id="categorySelect">
              ${state.categories.map(c => `
                <option value="${esc(c)}"
                  ${state.category===c?'selected':''}>${esc(c)}</option>
              `).join('')}
              <option value="Özel" ${state.custom?'selected':''}>Özel Kategori</option>
            </select>
          </label>
          <div id="customFields" style="display:${state.custom?'block':'none'}">
            <label>Özel kategori adı
              <input name="customTitle" maxlength="40"
                value="${state.custom?esc(state.category):''}"
                placeholder="Örneğin: Filmler">
            </label>
            <label>Kelimeler (her satıra bir kelime)
              <textarea name="customWords" placeholder="MATRİX&#10;TİTANİK&#10;AVATAR"></textarea>
            </label>
          </div>
          <label>Tur sayısı
            <select name="roundLimit">
              ${[3,5,7,10,15,20].map(n => `
                <option value="${n}" ${state.roundLimit===n?'selected':''}>
                  ${n} tur
                </option>
              `).join('')}
            </select>
          </label>
          <button class="btn secondary" type="submit">Ayarları Kaydet</button>
        </form>
        <button class="btn" id="startBtn"
          ${state.players.length<2?'disabled':''}>🚀 Oyunu Başlat</button>
      ` : `
        <div class="info">
          Kategori: <strong>${esc(state.category)}</strong><br>
          Tur: <strong>${state.roundLimit}</strong><br>
          Oda sahibinin oyunu başlatması bekleniyor.
        </div>
      `}
    </div>
    <button class="btn secondary" id="leaveBtn">Odadan Ayrıl</button>
  `;
}

function drawing(wrong) {
  return `
    <svg class="hangman" viewBox="0 0 220 230" aria-label="Adam asmaca çizimi">
      <line class="base" x1="30" y1="210" x2="150" y2="210"/>
      <line class="base" x1="65" y1="210" x2="65" y2="15"/>
      <line class="base" x1="65" y1="15" x2="145" y2="15"/>
      <line class="base" x1="145" y1="15" x2="145" y2="42"/>
      ${wrong>=1?'<circle cx="145" cy="65" r="23"/>':''}
      ${wrong>=2?'<line x1="145" y1="88" x2="145" y2="145"/>':''}
      ${wrong>=3?'<line x1="145" y1="105" x2="110" y2="128"/>':''}
      ${wrong>=4?'<line x1="145" y1="105" x2="180" y2="128"/>':''}
      ${wrong>=5?'<line x1="145" y1="145" x2="112" y2="187"/>':''}
      ${wrong>=6?'<line x1="145" y1="145" x2="178" y2="187"/>':''}
    </svg>
  `;
}

function game() {
  const mine = state.turnId === state.meId;
  const current = state.players.find(p => p.id===state.turnId);
  const masked = [...(state.masked || '')];

  return `
    ${notice()}
    <div class="topline">
      <span class="tag">TUR ${state.round}/${state.roundLimit}</span>
      <span class="tag">${esc(state.category)}</span>
    </div>

    <div class="card center">
      <h2>${mine?'🎯 Sıra Sende!':'⏳ '+esc(current?.name||'Oyuncu')+' oynuyor'}</h2>
      <p class="muted">${esc(state.message)}</p>
      ${drawing(state.wrong)}
      <p>❌ Yanlış: <strong>${state.wrong}/6</strong></p>
      <div class="word">
        ${masked.map(c => c===' '
          ? '<span class="letter space"></span>'
          : `<span class="letter">${esc(c==='_'?'':c)}</span>`
        ).join('')}
      </div>

      <div class="keyboard">
        ${ALPHABET.map(c => `
          <button class="key ${state.guessed.includes(c)?'used':''}"
            data-letter="${c}"
            ${!mine||state.guessed.includes(c)?'disabled':''}>
            ${c}
          </button>
        `).join('')}
      </div>

      <form id="wordForm">
        <label>Kelimeyi doğrudan tahmin et
          <input name="word" placeholder="Kelimeyi yaz"
            ${!mine?'disabled':''} required maxlength="35">
        </label>
        <button class="btn" type="submit" ${!mine?'disabled':''}>
          Kelimeyi Tahmin Et
        </button>
      </form>
      <p class="hint">Doğru harf: +10 puan · Kelimeyi tamamlamak: +50 · Doğru kelime: +100</p>
    </div>

    <div class="card">
      <h2>🏆 Puan Tablosu</h2>
      ${scores()}
    </div>
  `;
}

function result() {
  const winner = state.players.find(p => p.id===state.winnerId);
  const host = state.meId===state.hostId;

  return `
    ${notice()}
    <div class="card center">
      <span class="tag">TUR ${state.round} TAMAMLANDI</span>
      <div class="winner">${winner?'🏆 '+esc(winner.name):'💀 Kelime Bilinemedi'}</div>
      <p class="muted">${esc(state.message)}</p>
      <p>Doğru kelime:</p>
      <h1 style="color:#c4b5fd;overflow-wrap:anywhere">
        ${esc(state.revealedWord)}
      </h1>
      ${host ? `
        <button class="btn" id="nextBtn">
          ${state.round>=state.roundLimit?'🏁 Sonuçları Göster':'➡️ Sonraki Tur'}
        </button>
      ` : `
        <div class="info">Oda sahibinin sonraki turu açması bekleniyor.</div>
      `}
    </div>
    <div class="card"><h2>⭐ Puanlar</h2>${scores()}</div>
  `;
}

function finished() {
  const sorted = [...state.players].sort((a,b)=>b.score-a.score);
  const top = sorted[0]?.score ?? 0;
  const winners = sorted.filter(p=>p.score===top);

  return `
    <div class="card center">
      <div class="logo">🏆</div>
      <h2>OYUN BİTTİ!</h2>
      <div class="winner">${winners.map(p=>esc(p.name)).join(' & ')}</div>
      <p class="muted">${winners.length>1?'Berabere!':'Oyunun kazananı!'}</p>
    </div>
    <div class="card">
      <h2>🏅 Final Sıralaması</h2>
      ${sorted.map((p,i)=>`
        <div class="resultrow">
          <strong>${i+1}. ${esc(p.name)}</strong>
          <strong>⭐ ${p.score}</strong>
        </div>
      `).join('')}
    </div>
    <button class="btn" id="leaveBtn">Yeni Oyun</button>
  `;
}

function render() {
  if (!state) {
    app.innerHTML = home();
  } else {
    const views = {
      lobby,
      playing:game,
      result,
      finished
    };
    app.innerHTML = (views[state.status] || home)();
  }
  bindEvents();
}

function bindEvents() {
  document.getElementById('createForm')?.addEventListener('submit', e => {
    e.preventDefault();
    perform('create',{name:e.target.elements.name.value});
  });

  document.getElementById('joinForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name=e.target.elements.name.value;
    code=e.target.elements.roomCode.value.trim().toUpperCase();
    perform('join',{name});
  });

  document.getElementById('copyCode')?.addEventListener('click',async () => {
    try {
      await navigator.clipboard.writeText(state.code);
      alert('Oda kodu kopyalandı: '+state.code);
    } catch {
      alert('Oda kodu: '+state.code);
    }
  });

  document.getElementById('categorySelect')?.addEventListener('change',e => {
    const fields=document.getElementById('customFields');
    if(fields) fields.style.display=e.target.value==='Özel'?'block':'none';
  });

  document.getElementById('configForm')?.addEventListener('submit',e => {
    e.preventDefault();
    const f=e.target.elements;
    perform('configure',{
      category:f.category.value,
      customTitle:f.customTitle.value,
      customWords:f.customWords.value,
      roundLimit:Number(f.roundLimit.value)
    });
  });

  document.getElementById('startBtn')?.addEventListener('click',() => {
    perform('start');
  });

  document.querySelectorAll('[data-letter]').forEach(btn => {
    btn.addEventListener('click',() => {
      perform('guess',{kind:'letter',value:btn.dataset.letter});
    });
  });

  document.getElementById('wordForm')?.addEventListener('submit',e => {
    e.preventDefault();
    perform('guess',{
      kind:'word',
      value:e.target.elements.word.value
    });
  });

  document.getElementById('nextBtn')?.addEventListener('click',() => {
    perform('next');
  });

  document.getElementById('leaveBtn')?.addEventListener('click',leave);
}

async function poll() {
  if (!code || !token || busy) return;

  try {
    const data=await request('state');
    const next=JSON.stringify(data.state);

    if(next!==lastVersion) {
      lastVersion=next;
      state=data.state;
      render();
    }
  } catch(e) {
    if(e.message==='Oda bulunamadı.' ||
       e.message==='Oturum geçersiz.') {
      leave();
    }
  }
}

render();
if(code && token) poll();
setInterval(poll,1500);
