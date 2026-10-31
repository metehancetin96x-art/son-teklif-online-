
'use strict';

const app = document.getElementById('app');
const API = '/api';
const ALPHABET = [...'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'];

const SESSION_KEY = 'hangman-session';

let code = '';
let token = '';
let state = null;
let busy = false;
let leaving = false;
let error = '';
let lastVersion = '';

try {
  const saved = JSON.parse(
    localStorage.getItem(SESSION_KEY) || '{}'
  );

  code = saved.code || '';
  token = saved.token || '';
} catch {}

const esc = value => String(value ?? '').replace(
  /[&<>"']/g,
  c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c])
);

function saveSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({code, token})
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);

  code = '';
  token = '';
  state = null;
  error = '';
  lastVersion = '';

  render();
}

async function request(action, extra = {}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action,
      code,
      token,
      ...extra
    })
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
  if (busy || leaving) return;

  busy = true;
  error = '';

  try {
    const data = await request(action, extra);

    if (data.code) code = data.code;
    if (data.token) token = data.token;
    if (data.state) state = data.state;

    saveSession();

    lastVersion = JSON.stringify(state);
    render();
  } catch (e) {
    error = e.message;
    render();
  } finally {
    busy = false;
  }
}

async function leaveRoom() {
  if (busy || leaving) return;

  const confirmed = confirm(
    'Odadan ayrılıp ana sayfaya dönmek istiyor musun?'
  );

  if (!confirmed) return;

  leaving = true;
  busy = true;
  error = '';

  try {
    if (code && token) {
      await request('leave');
    }

    clearSession();
  } catch (e) {
    if (
      e.message === 'Oda bulunamadı.' ||
      e.message === 'Oturum geçersiz.'
    ) {
      clearSession();
    } else {
      error = 'Odadan çıkılamadı: ' + e.message;
      render();
    }
  } finally {
    leaving = false;
    busy = false;
  }
}

function notice() {
  return error
    ? `<div class="notice">${esc(error)}</div>`
    : '';
}

function scores() {
  const players = [...state.players].sort(
    (a, b) => b.score - a.score
  );

  return `
    <div class="scoreboard">
      ${players.map(p => `
        <div class="player ${p.id === state.meId ? 'me' : ''}">
          <div class="name">
            ${esc(p.name)}
            ${p.id === state.meId ? '✏️' : ''}
          </div>
          <div class="balance">
            ★ ${p.score}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function homeButton() {
  return `
    <button
      type="button"
      class="btn secondary"
      id="backHomeBtn"
      style="margin-top:12px">
      ⌂ Ana Sayfaya Dön
    </button>
  `;
}

function home() {
  return `
    ${notice()}

    <div class="card">
      <h2>✏️ Yeni Oyun</h2>

      <p class="muted">
        Bir oda oluştur, kodu arkadaşlarınla paylaş.
      </p>

      <form id="createForm">
        <label>
          Oyuncu adın
          <input
            name="name"
            maxlength="22"
            required
            placeholder="Adını yaz">
        </label>

        <button class="btn" type="submit">
          Oda Oluştur
        </button>
      </form>
    </div>

    <div class="card">
      <h2>🔑 Odaya Katıl</h2>

      <form id="joinForm">
        <label>
          Oyuncu adın
          <input
            name="name"
            maxlength="22"
            required
            placeholder="Adını yaz">
        </label>

        <label>
          Oda kodu
          <input
            name="roomCode"
            maxlength="6"
            required
            placeholder="ABC123"
            style="text-transform:uppercase">
        </label>

        <button
          class="btn secondary"
          type="submit">
          Odaya Katıl
        </button>
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

      <p class="muted">
        Arkadaşlarına bu kodu gönder.
      </p>

      <div class="room-code">
        ${esc(state.code)}
      </div>

      <button
        class="small secondary"
        id="copyCode">
        Kodu Kopyala
      </button>

      <p>${state.players.length}/6 oyuncu</p>
    </div>

    <div class="card">
      <h2>Oyuncular</h2>
      ${scores()}
    </div>

    <div class="card">
      <h2>Oyun Ayarları</h2>

      ${host ? `
        <form id="configForm">

          <label>
            Kategori
            <select
              name="category"
              id="categorySelect">

              ${state.categories.map(c => `
                <option
                  value="${esc(c)}"
                  ${!state.custom && state.category === c
                    ? 'selected'
                    : ''}>
                  ${esc(c)}
                </option>
              `).join('')}

              <option
                value="Özel"
                ${state.custom ? 'selected' : ''}>
                Özel Kategori
              </option>
            </select>
          </label>

          <div
            id="customFields"
            style="display:${state.custom ? 'block' : 'none'}">

            <label>
              Özel kategori adı
              <input
                name="customTitle"
                maxlength="40"
                value="${state.custom ? esc(state.category) : ''}"
                placeholder="Örneğin: Filmler">
            </label>

            <label>
              Kelimeler (her satıra bir kelime)
              <textarea
                name="customWords"
                placeholder="KELİME BİR&#10;KELİME İKİ"></textarea>
            </label>
          </div>

          <label>
            Zorluk Seviyesi
            <select name="difficulty">
              ${['Kolay', 'Orta', 'Zor'].map(d => `
                <option
                  value="${d}"
                  ${state.difficulty === d ? 'selected' : ''}>
                  ${d}
                </option>
              `).join('')}
            </select>
          </label>

          <label>
            Tur Sayısı
            <select name="roundLimit">
              ${[3, 5, 7, 10, 15, 20].map(n => `
                <option
                  value="${n}"
                  ${state.roundLimit === n ? 'selected' : ''}>
                  ${n} Tur
                </option>
              `).join('')}
            </select>
          </label>

          <button
            class="btn secondary"
            type="submit">
            Ayarları Kaydet
          </button>
        </form>

        <button
          class="btn"
          id="startBtn"
          ${state.players.length < 2 ? 'disabled' : ''}>
          Oyunu Başlat
        </button>

      ` : `
        <div class="info">
          Kategori: ${esc(state.category)}<br>
          Zorluk: ${esc(state.difficulty)}<br>
          Tur Sayısı: ${state.roundLimit}<br>
          Oda sahibi bekleniyor.
        </div>
      `}
    </div>

    ${homeButton()}
  `;
}

function drawing(wrong) {
  return `
    <svg
      class="hangman"
      viewBox="0 0 220 230"
      aria-label="Adam asmaca çizimi">

      <line class="base"
        x1="30" y1="210"
        x2="150" y2="210"/>

      <line class="base"
        x1="65" y1="210"
        x2="65" y2="15"/>

      <line class="base"
        x1="65" y1="15"
        x2="145" y2="15"/>

      <line class="base"
        x1="145" y1="15"
        x2="145" y2="42"/>

      ${wrong >= 1
        ? '<circle cx="145" cy="65" r="23"/>'
        : ''}

      ${wrong >= 2
        ? '<line x1="145" y1="88" x2="145" y2="145"/>'
        : ''}

      ${wrong >= 3
        ? '<line x1="145" y1="105" x2="110" y2="128"/>'
        : ''}

      ${wrong >= 4
        ? '<line x1="145" y1="105" x2="180" y2="128"/>'
        : ''}

      ${wrong >= 5
        ? '<line x1="145" y1="145" x2="112" y2="187"/>'
        : ''}

      ${wrong >= 6
        ? '<line x1="145" y1="145" x2="178" y2="187"/>'
        : ''}
    </svg>
  `;
}

function game() {
  const mine = state.turnId === state.meId;

  const current = state.players.find(
    p => p.id === state.turnId
  );

  return `
    ${notice()}

    <div class="topline">
      <span class="tag">
        TUR ${state.round}/${state.roundLimit}
      </span>

      <span class="tag">
        ${esc(state.difficulty)}
      </span>
    </div>

    <div class="card center">
      <h2>
        ${mine
          ? '✏️ Sıra Sende!'
          : 'Sıra: ' + esc(current?.name || 'Oyuncu')}
      </h2>

      <p class="muted">
        ${esc(state.category)}
      </p>

      ${drawing(state.wrong)}

      <p>
        Yanlış Tahmin:
        <strong>
          ${state.wrong}/${state.maxWrong}
        </strong>
      </p>

      <div class="word">
        ${[...(state.masked || '')].map(c =>
          c === ' '
            ? '<span class="letter space"></span>'
            : `<span class="letter">
                ${esc(c === '_' ? '' : c)}
              </span>`
        ).join('')}
      </div>

      <p>${esc(state.message)}</p>

      <div class="keyboard">
        ${ALPHABET.map(c => `
          <button
            class="key ${state.guessed.includes(c) ? 'used' : ''}"
            data-letter="${c}"
            ${!mine || state.guessed.includes(c)
              ? 'disabled'
              : ''}>
            ${c}
          </button>
        `).join('')}
      </div>

      <form id="wordForm">
        <label>
          Kelimeyi Tahmin Et
          <input
            name="word"
            maxlength="35"
            placeholder="Kelimeyi yaz"
            ${!mine ? 'disabled' : ''}
            required>
        </label>

        <button
          class="btn"
          type="submit"
          ${!mine ? 'disabled' : ''}>
          Tahmin Et
        </button>
      </form>

      <p class="hint">
        Doğru harf: +10 ·
        Doğru kelime: +100 ve kapalı harf başına +10 ·
        Adamı astırmak: −100
      </p>
    </div>

    <div class="card">
      <h2>Puan Tablosu</h2>
      ${scores()}
    </div>

    ${homeButton()}
  `;
}

function result() {
  const winner = state.players.find(
    p => p.id === state.winnerId
  );

  const host = state.meId === state.hostId;

  return `
    ${notice()}

    <div class="card center">
      <span class="tag">
        TUR ${state.round} TAMAMLANDI
      </span>

      <div class="winner">
        ${winner
          ? '★ ' + esc(winner.name)
          : 'Adam Asıldı!'}
      </div>

      <p>${esc(state.message)}</p>

      <p>Doğru Kelime</p>

      <h1 style="
        color:var(--yellow);
        overflow-wrap:anywhere">
        ${esc(state.revealedWord)}
      </h1>

      ${host ? `
        <button class="btn" id="nextBtn">
          ${state.round >= state.roundLimit
            ? 'Sonuçları Göster'
            : 'Sonraki Tur'}
        </button>
      ` : `
        <div class="info">
          Oda sahibinin sonraki turu açması bekleniyor.
        </div>
      `}
    </div>

    <div class="card">
      <h2>Puanlar</h2>
      ${scores()}
    </div>

    ${homeButton()}
  `;
}

function finished() {
  const sorted = [...state.players].sort(
    (a, b) => b.score - a.score
  );

  const top = sorted[0]?.score ?? 0;

  const winners = sorted.filter(
    p => p.score === top
  );

  return `
    <div class="card center">
      <div class="logo">🏆</div>

      <h2>OYUN BİTTİ!</h2>

      <div class="winner">
        ${winners.map(p => esc(p.name)).join(' & ')}
      </div>

      <p>
        ${winners.length > 1
          ? 'Oyun berabere bitti!'
          : 'Oyunun kazananı!'}
      </p>
    </div>

    <div class="card">
      <h2>Final Sıralaması</h2>

      ${sorted.map((p, i) => `
        <div class="resultrow">
          <strong>
            ${i + 1}. ${esc(p.name)}
          </strong>

          <strong>★ ${p.score}</strong>
        </div>
      `).join('')}
    </div>

    ${homeButton()}
  `;
}

function render() {
  if (!state) {
    app.innerHTML = home();
  } else {
    const views = {
      lobby,
      playing: game,
      result,
      finished
    };

    app.innerHTML = (views[state.status] || home)();
  }

  bindEvents();
}

function bindEvents() {
  document.getElementById('createForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();

      perform('create', {
        name: e.target.elements.name.value
      });
    });

  document.getElementById('joinForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();

      code = e.target.elements.roomCode.value
        .trim()
        .toUpperCase();

      perform('join', {
        name: e.target.elements.name.value
      });
    });

  document.getElementById('copyCode')
    ?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(state.code);
        alert('Kod kopyalandı: ' + state.code);
      } catch {
        alert('Oda kodu: ' + state.code);
      }
    });

  document.getElementById('categorySelect')
    ?.addEventListener('change', e => {
      const fields = document.getElementById('customFields');

      if (fields) {
        fields.style.display =
          e.target.value === 'Özel'
            ? 'block'
            : 'none';
      }
    });

  document.getElementById('configForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();

      const f = e.target.elements;

      perform('configure', {
        category: f.category.value,
        customTitle: f.customTitle.value,
        customWords: f.customWords.value,
        difficulty: f.difficulty.value,
        roundLimit: Number(f.roundLimit.value)
      });
    });

  document.getElementById('startBtn')
    ?.addEventListener('click', () => {
      perform('start');
    });

  document.querySelectorAll('[data-letter]')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        perform('guess', {
          kind: 'letter',
          value: btn.dataset.letter
        });
      });
    });

  document.getElementById('wordForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();

      perform('guess', {
        kind: 'word',
        value: e.target.elements.word.value
      });
    });

  document.getElementById('nextBtn')
    ?.addEventListener('click', () => {
      perform('next');
    });

  document.getElementById('backHomeBtn')
    ?.addEventListener('click', leaveRoom);
}

async function poll() {
  if (!code || !token || busy || leaving) return;

  try {
    const data = await request('state');
    const next = JSON.stringify(data.state);

    if (next !== lastVersion) {
      lastVersion = next;
      state = data.state;
      render();
    }
  } catch (e) {
    if (
      e.message === 'Oda bulunamadı.' ||
      e.message === 'Oturum geçersiz.'
    ) {
      clearSession();
    }
  }
}

render();

if (code && token) {
  poll();
}

setInterval(poll, 1500);
