
'use strict';

const app = document.getElementById('app');
const API = '/api';
const SESSION_KEY = 'hangman-session';
const ALPHABET = [...'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'];

let code = '';
let token = '';
let state = null;
let busy = false;
let leaving = false;
let error = '';
let lastVersion = '';
let clockOffset = 0;
let lastTurnKey = '';
let celebratedKey = '';
let audioContext = null;
let soundEnabled = false;
let draftSettings = null;
let confettiTimer = null;
let pollRunning = false;

try {
  const saved = JSON.parse(
    localStorage.getItem(SESSION_KEY) || '{}'
  );
  code = saved.code || '';
  token = saved.token || '';
} catch (_) {}

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

function ensureStyles() {
  if (document.getElementById('gameExtraStyles')) return;

  const style = document.createElement('style');
  style.id = 'gameExtraStyles';

  style.textContent = `
    .card {
      padding: 11px !important;
      margin-bottom: 8px !important;
    }

    .card h2 {
      margin: 2px 0 7px !important;
      font-size: 1.25rem !important;
    }

    .card p {
      margin: 5px 0 !important;
    }

    .topline {
      margin-bottom: 6px !important;
    }

    .hangman {
      width: 150px !important;
      height: 150px !important;
      display: block;
      margin: 0 auto !important;
    }

    .word {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 5px;
      margin: 12px 0 !important;
    }

    .word .letter {
      min-width: 27px !important;
      min-height: 39px !important;
      padding: 3px !important;
      font-size: 1.35rem !important;
      border-bottom: 3px solid #fff8e6 !important;
    }

    .word .space {
      min-width: 13px !important;
      border-bottom: none !important;
    }

    .keyboard {
      display: grid !important;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      gap: 4px !important;
      margin: 9px 0 !important;
    }

    .keyboard .key {
      position: relative;
      width: 100% !important;
      min-width: 0 !important;
      min-height: 35px !important;
      padding: 4px 0 !important;
      font-size: 1rem !important;
      line-height: 1.2;
    }

    .keyboard .key.used {
      opacity: .65;
    }

    .keyboard .key.used::after {
      content: '✕';
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ff6767;
      font-size: 1.75rem;
      font-weight: 900;
      text-shadow: 0 1px 3px #000;
      pointer-events: none;
    }

    .compact-game form {
      margin-top: 6px !important;
    }

    .compact-game input {
      margin: 4px 0 !important;
    }

    .compact-game .hint {
      font-size: .76rem;
      line-height: 1.3;
    }

    .timer-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 6px 0;
      padding: 6px 10px;
      border: 1px solid #ffffff55;
      border-radius: 9px;
      font-weight: bold;
    }

    .timer-number {
      font-size: 1.5rem;
      font-variant-numeric: tabular-nums;
    }

    .timer-box.urgent {
      border-color: #ff6868;
      color: #ff7777;
      animation: timerPulse .7s infinite alternate;
    }

    @keyframes timerPulse {
      from { opacity: 1; }
      to { opacity: .6; }
    }

    .compact-scoreboard {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      justify-content: center;
      margin: 5px 0;
    }

    .score-chip {
      border: 1px solid #ffffff55;
      border-radius: 8px;
      padding: 4px 7px;
      font-size: .84rem;
    }

    .score-chip.active {
      border-color: #f4d66d;
    }

    .score-chip.me {
      font-weight: bold;
    }

    .game-exit {
      display: block;
      width: 100%;
      margin: 8px 0 !important;
      padding: 8px !important;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .settings-grid label:first-child {
      grid-column: 1 / -1;
    }

    .settings-grid select {
      width: 100%;
    }

    .confetti-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      overflow: hidden;
      pointer-events: none;
    }

    .confetti-piece {
      position: absolute;
      top: -30px;
      width: 9px;
      height: 15px;
      animation: confettiFall linear forwards;
    }

    @keyframes confettiFall {
      0% {
        transform: translate3d(0,-20px,0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--drift),110vh,0)
          rotate(var(--spin));
        opacity: 0;
      }
    }

    .celebration-banner {
      position: fixed;
      z-index: 10000;
      top: 23%;
      left: 50%;
      transform: translateX(-50%);
      width: min(88vw,350px);
      padding: 20px;
      text-align: center;
      border: 3px solid #f4d66d;
      border-radius: 15px;
      background: #183d2c;
      color: #fff;
      box-shadow: 0 12px 45px #0009;
      animation: celebrationPop .45s ease-out;
    }

    @keyframes celebrationPop {
      from {
        transform: translateX(-50%) scale(.5);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) scale(1);
        opacity: 1;
      }
    }

    .celebration-banner h2 {
      color: #f4d66d;
      margin: 8px 0;
    }

    @media (max-width:370px) {
      .keyboard {
        grid-template-columns: repeat(8,minmax(0,1fr));
      }

      .keyboard .key {
        min-height: 32px !important;
      }

      .hangman {
        width: 135px !important;
        height: 135px !important;
      }

      .word .letter {
        min-width: 24px !important;
        min-height: 36px !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function saveSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ code, token })
  );
}

function removeConfetti() {
  if (confettiTimer) clearTimeout(confettiTimer);
  confettiTimer = null;
  document.getElementById('confettiOverlay')?.remove();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);

  code = '';
  token = '';
  state = null;
  error = '';
  lastVersion = '';
  lastTurnKey = '';
  celebratedKey = '';
  draftSettings = null;

  removeConfetti();
  render();
}

async function request(action, extra = {}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    cache: 'no-store',
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
  } catch (_) {
    throw new Error('Sunucu yanıt vermiyor.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'İşlem başarısız.');
  }

  return data;
}

function syncClock(s) {
  if (typeof s?.serverNow === 'number') {
    clockOffset = s.serverNow - Date.now();
  }
}

// Sunucu saati değiştiğinde ekranı yenileme.
function stateSignature(s) {
  if (!s) return '';

  const { serverNow, ...stableState } = s;
  return JSON.stringify(stableState);
}

function isEditingLobby() {
  if (state?.status !== 'lobby') return false;

  const form = document.getElementById('startForm');
  const active = document.activeElement;

  return !!(
    form &&
    active &&
    form.contains(active) &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(
      active.tagName
    )
  );
}

function isEditingWord() {
  if (state?.status !== 'playing') return false;

  const input = document.querySelector(
    '#wordForm input[name="word"]'
  );

  return !!(
    input &&
    document.activeElement === input
  );
}

// Ekranı yeniden oluştururken formun durumunu koru.
function captureInput() {
  const active = document.activeElement;

  if (!active || !app.contains(active)) return null;

  const id = active.id;
  const name = active.name;
  const value = active.value;

  let selectionStart = null;
  let selectionEnd = null;

  try {
    selectionStart = active.selectionStart;
    selectionEnd = active.selectionEnd;
  } catch (_) {}

  return {
    id,
    name,
    value,
    selectionStart,
    selectionEnd,
    tag: active.tagName
  };
}

function restoreInput(saved) {
  if (!saved) return;

  let element = null;

  if (saved.id) {
    element = document.getElementById(saved.id);
  }

  if (!element && saved.name) {
    element = Array.from(
      app.querySelectorAll('[name]')
    ).find(el => el.name === saved.name);
  }

  if (!element || element.disabled) return;

  if (
    saved.tag === 'INPUT' ||
    saved.tag === 'TEXTAREA'
  ) {
    element.value = saved.value;
  }

  // iPhone'da odak gereksiz yere kaybolmasın.
  // SELECT menüsünü açıkken yeniden oluşturmuyoruz.
  if (saved.tag !== 'SELECT') {
    try {
      element.focus({ preventScroll: true });

      if (
        saved.selectionStart !== null &&
        saved.selectionEnd !== null
      ) {
        element.setSelectionRange(
          saved.selectionStart,
          saved.selectionEnd
        );
      }
    } catch (_) {}
  }
}

function acceptState(nextState) {
  if (!nextState) return;

  const previousStatus = state?.status;

  syncClock(nextState);
  state = nextState;
  lastVersion = stateSignature(nextState);

  if (
    nextState.status === 'lobby' &&
    previousStatus !== 'lobby'
  ) {
    draftSettings = null;
  }

  const turnKey = nextState.status === 'playing'
    ? `${nextState.code}:${nextState.round}:${nextState.turnId}:${nextState.turnEndsAt}`
    : '';

  if (turnKey && turnKey !== lastTurnKey) {
    lastTurnKey = turnKey;

    if (nextState.turnId === nextState.meId) {
      notifyTurn();
    }
  }

  const finishKey = nextState.status === 'finished'
    ? `${nextState.code}:${nextState.round}:finished`
    : '';

  render();

  if (finishKey && celebratedKey !== finishKey) {
    celebratedKey = finishKey;
    celebrate();
  }
}

async function perform(action, extra = {}) {
  if (busy || leaving) return;

  busy = true;
  error = '';

  try {
    const data = await request(action, extra);

    if (data.code) code = data.code;
    if (data.token) token = data.token;

    saveSession();

    if (data.state) {
      acceptState(data.state);
    }

    if (action === 'start') {
      draftSettings = null;
    }
  } catch (e) {
    error = e.message;
    render();
  } finally {
    busy = false;
  }
}

async function leaveRoom() {
  if (busy || leaving) return;

  if (!confirm(
    'Odadan ayrılıp ana sayfaya dönmek istiyor musun?'
  )) {
    return;
  }

  leaving = true;
  busy = true;

  try {
    if (code && token) {
      await request('leave');
    }

    clearSession();
  } catch (e) {
    if ([
      'Oda bulunamadı.',
      'Oturum geçersiz.'
    ].includes(e.message)) {
      clearSession();
    } else {
      error = 'Odadan çıkılamadı: ' + e.message;
      render();
    }
  } finally {
    busy = false;
    leaving = false;
  }
}

function enableSound() {
  try {
    const Ctx =
      window.AudioContext || window.webkitAudioContext;

    if (!Ctx) return;

    if (!audioContext) {
      audioContext = new Ctx();
    }

    audioContext.resume().catch(() => {});
    soundEnabled = true;
  } catch (_) {}
}

function beep(frequency = 740, duration = .16, delay = 0) {
  if (!soundEnabled || !audioContext) return;

  try {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + delay;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      .15,
      start + .015
    );
    gain.gain.exponentialRampToValueAtTime(
      .0001,
      start + duration
    );

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start(start);
    osc.stop(start + duration + .02);
  } catch (_) {}
}

function notifyTurn() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  beep(740, .14);
  beep(980, .18, .18);
}

function celebrate() {
  removeConfetti();

  const sorted = [...state.players].sort(
    (a, b) => b.score - a.score
  );

  const top = sorted[0]?.score ?? 0;
  const winners = sorted.filter(p => p.score === top);

  const overlay = document.createElement('div');
  overlay.id = 'confettiOverlay';
  overlay.className = 'confetti-overlay';

  const colors = [
    '#f4d66d',
    '#ff6b6b',
    '#63d6b0',
    '#ffffff',
    '#8ab4ff',
    '#e58aff'
  ];

  for (let i = 0; i < 110; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';

    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background =
      colors[Math.floor(Math.random() * colors.length)];

    piece.style.animationDuration =
      `${2.4 + Math.random() * 2.5}s`;

    piece.style.animationDelay =
      `${Math.random() * 1.2}s`;

    piece.style.setProperty(
      '--drift',
      `${Math.random() * 180 - 90}px`
    );

    piece.style.setProperty(
      '--spin',
      `${Math.random() * 900 - 450}deg`
    );

    overlay.appendChild(piece);
  }

  const banner = document.createElement('div');
  banner.className = 'celebration-banner';

  banner.innerHTML = `
    <div style="font-size:2.4rem">🏆🎉</div>
    <h2>${winners.length > 1 ? 'BERABERE!' : 'KAZANAN!'}</h2>
    <div style="font-size:1.3rem;font-weight:bold">
      ${winners.map(p => esc(p.name)).join(' & ')}
    </div>
    <p>★ ${top} puan</p>
  `;

  overlay.appendChild(banner);
  document.body.appendChild(overlay);

  if (navigator.vibrate) {
    navigator.vibrate([150, 80, 150, 80, 300]);
  }

  beep(660, .16);
  beep(880, .16, .18);
  beep(1100, .35, .36);

  confettiTimer = setTimeout(removeConfetti, 5200);
}

function notice() {
  return error
    ? `<div class="notice">${esc(error)}</div>`
    : '';
}

function scores() {
  return `
    <div class="compact-scoreboard">
      ${[...state.players]
        .sort((a, b) => b.score - a.score)
        .map(p => `
          <div class="score-chip
            ${p.id === state.meId ? 'me' : ''}
            ${p.id === state.turnId ? 'active' : ''}">
            ${esc(p.name)} ★ ${p.score}
          </div>
        `).join('')}
    </div>
  `;
}

function homeButton() {
  return `
    <button
      class="btn secondary game-exit"
      id="backHomeBtn"
      type="button">
      ⌂ Ana Sayfaya Dön
    </button>
  `;
}

function home() {
  return `
    ${notice()}

    <div class="card">
      <h2>✏️ Yeni Oyun</h2>

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

function currentSettings() {
  return draftSettings || {
    category: state.custom ? 'Özel' : state.category,
    customTitle: state.custom ? state.category : '',
    customWords: '',
    difficulty: state.difficulty,
    roundLimit: state.roundLimit
  };
}

function lobby() {
  const host = state.meId === state.hostId;
  const settings = currentSettings();

  return `
    ${notice()}

    <div class="card center">
      <span class="tag">BEKLEME ODASI</span>

      <div class="room-code">
        ${esc(state.code)}
      </div>

      <button class="small secondary" id="copyCode">
        Kodu Kopyala
      </button>

      <p>${state.players.length}/6 oyuncu</p>
      ${scores()}
    </div>

    <div class="card">
      <h2>Oyun Ayarları</h2>

      ${host ? `
        <form id="startForm">
          <div class="settings-grid">
            <label>
              Kategori
              <select name="category" id="categorySelect">
                ${state.categories.map(c => `
                  <option
                    value="${esc(c)}"
                    ${settings.category === c
                      ? 'selected'
                      : ''}>
                    ${esc(c)}
                  </option>
                `).join('')}

                <option
                  value="Özel"
                  ${settings.category === 'Özel'
                    ? 'selected'
                    : ''}>
                  Özel Kategori
                </option>
              </select>
            </label>

            <label>
              Zorluk
              <select name="difficulty">
                ${['Kolay', 'Orta', 'Zor'].map(d => `
                  <option
                    value="${d}"
                    ${settings.difficulty === d
                      ? 'selected'
                      : ''}>
                    ${d}
                  </option>
                `).join('')}
              </select>
            </label>

            <label>
              Tur Sayısı
              <select name="roundLimit">
                ${Array.from(
                  { length: 20 },
                  (_, i) => i + 1
                ).map(n => `
                  <option
                    value="${n}"
                    ${Number(settings.roundLimit) === n
                      ? 'selected'
                      : ''}>
                    ${n} Tur
                  </option>
                `).join('')}
              </select>
            </label>
          </div>

          <div
            id="customFields"
            style="display:${settings.category === 'Özel'
              ? 'block'
              : 'none'}">

            <label>
              Özel kategori adı
              <input
                name="customTitle"
                maxlength="40"
                value="${esc(settings.customTitle)}"
                placeholder="Kategori adı">
            </label>

            <label>
              Kelimeler (her satıra bir kelime)
              <textarea
                name="customWords"
                placeholder="KELİME BİR&#10;KELİME İKİ">${esc(settings.customWords)}</textarea>
            </label>
          </div>

          <button
            class="btn"
            type="submit"
            ${state.players.length < 2 ? 'disabled' : ''}>
            ▶ Oyunu Başlat
          </button>
        </form>
      ` : `
        <div class="info">
          Kategori: ${esc(state.category)}<br>
          Zorluk: ${esc(state.difficulty)}<br>
          Tur: ${state.roundLimit}<br>
          Oda sahibinin oyunu başlatması bekleniyor.
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

      <g
        fill="none"
        stroke="currentColor"
        stroke-width="5"
        stroke-linecap="round">

        <line x1="30" y1="210" x2="150" y2="210"/>
        <line x1="65" y1="210" x2="65" y2="15"/>
        <line x1="65" y1="15" x2="145" y2="15"/>
        <line x1="145" y1="15" x2="145" y2="42"/>

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
      </g>
    </svg>
  `;
}

function secondsLeft() {
  if (!state?.turnEndsAt) return 0;

  return Math.max(
    0,
    Math.ceil(
      (
        state.turnEndsAt -
        (Date.now() + clockOffset)
      ) / 1000
    )
  );
}

function game() {
  const mine = state.turnId === state.meId;

  const current = state.players.find(
    p => p.id === state.turnId
  );

  return `
    ${notice()}

    <div class="compact-game">
      <div class="topline">
        <span class="tag">
          TUR ${state.round}/${state.roundLimit}
        </span>

        <span class="tag">
          ${esc(state.category)} · ${esc(state.difficulty)}
        </span>
      </div>

      <div class="card center">
        <div class="timer-box" id="timerBox">
          <span>
            ${mine
              ? '✏️ SIRA SENDE!'
              : 'Sıra: ' + esc(current?.name || 'Oyuncu')}
          </span>

          <span class="timer-number" id="timerNumber">
            ${secondsLeft()} sn
          </span>
        </div>

        ${drawing(state.wrong)}

        <p>
          Yanlış:
          <strong>${state.wrong}/${state.maxWrong}</strong>
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

        <p class="muted">
          ${esc(state.message)}
        </p>

        <div class="keyboard">
          ${ALPHABET.map(c => `
            <button
              type="button"
              class="key ${state.guessed.includes(c)
                ? 'used'
                : ''}"
              data-letter="${c}"
              ${!mine || state.guessed.includes(c)
                ? 'disabled'
                : ''}>
              ${c}
            </button>
          `).join('')}
        </div>

        <form id="wordForm">
          <input
            name="word"
            maxlength="35"
            placeholder="Kelimeyi tahmin et"
            autocomplete="off"
            ${!mine ? 'disabled' : ''}
            required>

          <button
            class="btn"
            type="submit"
            ${!mine ? 'disabled' : ''}>
            Kelimeyi Tahmin Et
          </button>
        </form>

        <p class="hint">
          Harf +10 · Kelime +100 ve gizli harf başına +10 ·
          Adamı astıran −100
        </p>
      </div>

      <div class="card center">
        ${scores()}
      </div>
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

      <h2>
        ${winner
          ? '★ ' + esc(winner.name)
          : 'Adam Asıldı!'}
      </h2>

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
            ? '🏆 Final Sonuçları'
            : 'Sonraki Tur'}
        </button>
      ` : `
        <p>Oda sahibi bekleniyor.</p>
      `}
    </div>

    <div class="card center">
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
  const winners = sorted.filter(p => p.score === top);
  const host = state.meId === state.hostId;

  return `
    ${notice()}

    <div class="card center">
      <div style="font-size:2.6rem">🏆🎉</div>
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

    ${host ? `
      <button class="btn" id="restartBtn">
        ↻ Yeni Oyun
      </button>

      <p class="muted center">
        Aynı oyuncularla kategori seçme ekranına dön.
      </p>
    ` : `
      <div class="card center">
        Oda sahibi yeni oyun başlatabilir.
      </div>
    `}

    ${homeButton()}
  `;
}

function render() {
  ensureStyles();

  const savedInput = captureInput();

  const views = {
    lobby,
    playing: game,
    result,
    finished
  };

  app.innerHTML = state
    ? (views[state.status] || home)()
    : home();

  bindEvents();
  updateTimer();

  if (savedInput) {
    restoreInput(savedInput);
  }
}

function collectSettings(form) {
  const f = form.elements;

  return {
    category: f.category.value,
    customTitle: f.customTitle.value,
    customWords: f.customWords.value,
    difficulty: f.difficulty.value,
    roundLimit: Number(f.roundLimit.value)
  };
}

function bindEvents() {
  document.getElementById('createForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();
      enableSound();

      perform('create', {
        name: e.target.elements.name.value
      });
    });

  document.getElementById('joinForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();
      enableSound();

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
      } catch (_) {
        alert('Oda kodu: ' + state.code);
      }
    });

  const startForm = document.getElementById('startForm');

  if (startForm) {
    const saveDraft = () => {
      draftSettings = collectSettings(startForm);
    };

    startForm.addEventListener('input', saveDraft);

    startForm.addEventListener('change', () => {
      saveDraft();

      const fields = document.getElementById('customFields');

      if (fields) {
        fields.style.display =
          draftSettings.category === 'Özel'
            ? 'block'
            : 'none';
      }
    });

    startForm.addEventListener('submit', e => {
      e.preventDefault();
      enableSound();
      saveDraft();

      perform('start', draftSettings);
    });
  }

  document.querySelectorAll('[data-letter]')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        enableSound();

        perform('guess', {
          kind: 'letter',
          value: btn.dataset.letter
        });
      });
    });

  document.getElementById('wordForm')
    ?.addEventListener('submit', e => {
      e.preventDefault();
      enableSound();

      perform('guess', {
        kind: 'word',
        value: e.target.elements.word.value
      });
    });

  document.getElementById('nextBtn')
    ?.addEventListener('click', () => {
      enableSound();
      perform('next');
    });

  document.getElementById('restartBtn')
    ?.addEventListener('click', () => {
      enableSound();
      perform('restart');
    });

  document.getElementById('backHomeBtn')
    ?.addEventListener('click', leaveRoom);
}

function updateTimer() {
  const number = document.getElementById('timerNumber');
  const box = document.getElementById('timerBox');

  if (
    !number ||
    !box ||
    state?.status !== 'playing'
  ) {
    return;
  }

  const seconds = secondsLeft();

  number.textContent = seconds + ' sn';
  box.classList.toggle('urgent', seconds <= 10);
}

// iPhone için güvenli otomatik güncelleme.
// Açık kategori menüsünü veya yazı alanını silmez.
async function poll() {
  if (
    !code ||
    !token ||
    busy ||
    leaving ||
    pollRunning
  ) {
    return;
  }

  pollRunning = true;

  try {
    const data = await request('state');
    const nextState = data.state;
    const next = stateSignature(nextState);

    syncClock(nextState);

    if (next === lastVersion) return;

    // Kategori, zorluk veya tur seçilirken
    // aynı bekleme odasında ekranı yenileme.
    if (
      isEditingLobby() &&
      nextState?.status === 'lobby'
    ) {
      const form = document.getElementById('startForm');

      if (form) {
        draftSettings = collectSettings(form);
      }

      // Sadece veri güncellenir.
      // HTML elemanları korunur.
      state = nextState;
      lastVersion = next;

      // Oyuncu sayısını ekranda güncelle.
      const count = document.getElementById(
        'lobbyPlayerCount'
      );

      if (count) {
        count.textContent =
          `${state.players.length}/6 oyuncu`;
      }

      return;
    }

    // Kelime yazarken aynı tur devam ediyorsa
    // iPhone klavyesini kapatma.
    if (
      isEditingWord() &&
      nextState?.status === 'playing' &&
      nextState.round === state.round &&
      nextState.turnId === state.turnId &&
      nextState.turnEndsAt === state.turnEndsAt
    ) {
      // Kelime yazılırken gereksiz ekran
      // yenilemelerini ertele.
      return;
    }

    acceptState(nextState);

  } catch (e) {
    if ([
      'Oda bulunamadı.',
      'Oturum geçersiz.'
    ].includes(e.message)) {
      clearSession();
    }
  } finally {
    pollRunning = false;
  }
}

document.addEventListener('pointerdown', () => {
  if (!soundEnabled) enableSound();
}, { once: true });

render();

if (code && token) {
  poll();
}

setInterval(poll, 1500);
setInterval(updateTimer, 250);
