
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const rooms = new Map();

const WORDS = {
  Hayvanlar: ['KAPLAN','ZÜRAFA','PENGUEN','KAPLUMBAĞA','TİMSAH','YUNUS','KARTAL','KELEBEK','GERGEDAN','PAPAĞAN'],
  Ülkeler: ['TÜRKİYE','ALMANYA','JAPONYA','BREZİLYA','KANADA','NORVEÇ','İSPANYA','İTALYA','ARJANTİN','PORTEKİZ'],
  Şehirler: ['İSTANBUL','ANKARA','İZMİR','ANTALYA','TRABZON','ESKİŞEHİR','ÇANAKKALE','SAMSUN','EDİRNE','GAZİANTEP'],
  Teknoloji: ['BİLGİSAYAR','TELEFON','KLAVYE','YAZILIM','İNTERNET','KULAKLIK','MONİTÖR','ROBOT','KAMERA','TABLET'],
  Yemekler: ['MANTI','BAKLAVA','LAHMACUN','İSKENDER','KARNIYARIK','KÖFTE','PİLAV','KÜNEFE','MENEMEN','DONDURMA'],
  Spor: ['FUTBOL','BASKETBOL','VOLEYBOL','TENİS','YÜZME','BİSİKLET','GÜREŞ','ATLETİZM','HENTBOL','BADMİNTON']
};

const uid = () => crypto.randomBytes(16).toString('hex');
const upper = s => String(s || '').trim().toLocaleUpperCase('tr-TR');

function reply(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function active(r) {
  return r.players[r.turn % r.players.length];
}

function nextTurn(r) {
  r.turn = (r.turn + 1) % r.players.length;
}

function newRound(r) {
  if (r.round >= r.roundLimit) {
    r.status = 'finished';
    return;
  }

  let available = r.words.filter(w => !r.used.includes(w));
  if (!available.length) {
    r.used = [];
    available = [...r.words];
  }

  r.word = available[crypto.randomInt(available.length)];
  r.used.push(r.word);
  r.guessed = [];
  r.wrong = 0;
  r.winnerId = null;
  r.revealedWord = null;
  r.turn = crypto.randomInt(r.players.length);
  r.round++;
  r.status = 'playing';
  r.message = 'Yeni kelime başladı!';
}

function view(r, token) {
  const me = r.players.find(p => p.token === token);

  return {
    code: r.code,
    status: r.status,
    meId: me?.id || null,
    hostId: r.hostId,
    players: r.players.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score
    })),
    categories: Object.keys(WORDS),
    category: r.category,
    round: r.round,
    roundLimit: r.roundLimit,
    wrong: r.wrong,
    maxWrong: 6,
    guessed: r.guessed,
    masked: r.word
      ? [...r.word].map(c =>
          c === ' ' ? ' ' :
          r.guessed.includes(c) ? c : '_'
        ).join('')
      : null,
    turnId: r.status === 'playing' ? active(r).id : null,
    winnerId: r.winnerId,
    revealedWord: r.revealedWord,
    message: r.message,
    custom: r.custom,
    wordCount: r.words.length
  };
}

function api(res, b) {
  const action = b.action;
  let r;

  if (action === 'create') {
    const name = String(b.name || '').trim().slice(0, 22);
    if (!name) return reply(res, 400, {error:'Adını gir.'});

    let code;
    do {
      code = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (rooms.has(code));

    const p = {id:uid(), token:uid(), name, score:0};

    r = {
      code,
      hostId:p.id,
      players:[p],
      status:'lobby',
      category:'Hayvanlar',
      words:WORDS.Hayvanlar,
      custom:false,
      round:0,
      roundLimit:5,
      turn:0,
      word:null,
      guessed:[],
      wrong:0,
      used:[],
      winnerId:null,
      revealedWord:null,
      message:'',
      created:Date.now()
    };

    rooms.set(code, r);
    return reply(res, 200, {
      code,
      token:p.token,
      state:view(r,p.token)
    });
  }

  r = rooms.get(upper(b.code));
  if (!r) return reply(res,404,{error:'Oda bulunamadı.'});

  if (action === 'join') {
    if (r.status !== 'lobby')
      return reply(res,409,{error:'Oyun başladı.'});

    if (r.players.length >= 6)
      return reply(res,409,{error:'Oda dolu.'});

    const name = String(b.name || '').trim().slice(0,22);

    if (!name || r.players.some(p =>
      p.name.toLocaleLowerCase('tr-TR') ===
      name.toLocaleLowerCase('tr-TR')
    )) return reply(res,400,{error:'Farklı bir oyuncu adı gir.'});

    const p = {id:uid(),token:uid(),name,score:0};
    r.players.push(p);

    return reply(res,200,{
      code:r.code,
      token:p.token,
      state:view(r,p.token)
    });
  }

  const p = r.players.find(x => x.token === b.token);
  if (!p) return reply(res,403,{error:'Oturum geçersiz.'});

  if (action === 'state')
    return reply(res,200,{state:view(r,p.token)});

  if (action === 'configure') {
    if (p.id !== r.hostId || r.status !== 'lobby')
      return reply(res,403,{error:'Yalnızca oda sahibi ayarlayabilir.'});

    const limit = Number(b.roundLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      return reply(res,400,{error:'Tur sayısı 1–20 olmalı.'});

    if (b.category === 'Özel') {
      const title = String(b.customTitle || '').trim().slice(0,40);
      const words = String(b.customWords || '')
        .split(/\r?\n/)
        .map(upper)
        .filter(w => /^[A-ZÇĞİÖŞÜ ]{2,35}$/.test(w));

      const unique = [...new Set(words)].slice(0,100);

      if (!title || unique.length < 2)
        return reply(res,400,{
          error:'Özel kategori adı ve en az iki kelime gir.'
        });

      r.category = title;
      r.words = unique;
      r.custom = true;
    } else {
      if (!WORDS[b.category])
        return reply(res,400,{error:'Kategori seç.'});

      r.category = b.category;
      r.words = WORDS[b.category];
      r.custom = false;
    }

    r.roundLimit = limit;
    return reply(res,200,{state:view(r,p.token)});
  }

  if (action === 'start') {
    if (p.id !== r.hostId || r.status !== 'lobby' ||
        r.players.length < 2)
      return reply(res,409,{
        error:'Başlamak için en az 2 oyuncu gerekli.'
      });

    newRound(r);
    return reply(res,200,{state:view(r,p.token)});
  }

  if (action === 'guess') {
    if (r.status !== 'playing')
      return reply(res,409,{error:'Tahminler kapalı.'});

    if (active(r).id !== p.id)
      return reply(res,403,{error:'Sıra sende değil.'});

    const value = upper(b.value);

    if (b.kind === 'letter') {
      if (!/^[A-ZÇĞİÖŞÜ]$/.test(value))
        return reply(res,400,{error:'Tek harf gir.'});

      if (r.guessed.includes(value))
        return reply(res,409,{error:'Bu harf zaten denendi.'});

      r.guessed.push(value);

      if (r.word.includes(value)) {
        const count = [...r.word].filter(c => c === value).length;
        p.score += count * 10;
        r.message = `${p.name} doğru harf buldu!`;
      } else {
        r.wrong++;
        r.message = `${p.name} yanlış harf söyledi.`;
      }

      const complete = [...r.word].every(c =>
        c === ' ' || r.guessed.includes(c)
      );

      if (complete) {
        p.score += 50;
        r.status = 'result';
        r.winnerId = p.id;
        r.revealedWord = r.word;
        r.message = `${p.name} kelimeyi tamamladı!`;
      } else if (r.wrong >= 6) {
        r.status = 'result';
        r.winnerId = null;
        r.revealedWord = r.word;
        r.message = 'Haklar bitti. Kelime: ' + r.word;
      } else {
        nextTurn(r);
      }
    } else if (b.kind === 'word') {
      if (value.length < 2 || value.length > 35)
        return reply(res,400,{error:'Geçerli kelime gir.'});

      if (value === r.word) {
        p.score += 100;
        r.status = 'result';
        r.winnerId = p.id;
        r.revealedWord = r.word;
        r.message = `${p.name} kelimeyi bildi! +100 puan`;
      } else {
        r.wrong = Math.min(6,r.wrong + 2);
        r.message = `${p.name} yanlış kelime tahmin etti.`;

        if (r.wrong >= 6) {
          r.status = 'result';
          r.winnerId = null;
          r.revealedWord = r.word;
        } else {
          nextTurn(r);
        }
      }
    } else {
      return reply(res,400,{error:'Geçersiz tahmin.'});
    }

    return reply(res,200,{state:view(r,p.token)});
  }

  if (action === 'next') {
    if (p.id !== r.hostId || r.status !== 'result')
      return reply(res,403,{
        error:'Sonraki turu oda sahibi açabilir.'
      });

    newRound(r);
    return reply(res,200,{state:view(r,p.token)});
  }

  return reply(res,400,{error:'Bilinmeyen işlem.'});
}

const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8'
};

http.createServer((req,res) => {
  let url;

  try {
    url = new URL(req.url,'http://localhost');
  } catch {
    return reply(res,400,{error:'Geçersiz adres.'});
  }

  if (url.pathname === '/api') {
    if (req.method !== 'POST')
      return reply(res,405,{error:'POST gerekli.'});

    let body = '';

    req.on('data',chunk => {
      body += chunk;
      if (body.length > 40000) req.destroy();
    });

    req.on('end',() => {
      try {
        api(res,JSON.parse(body || '{}'));
      } catch(e) {
        console.error(e);
        if (!res.headersSent)
          reply(res,500,{error:'Sunucu hatası.'});
      }
    });
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }

  const file = path.resolve(
    ROOT,
    '.' + (pathname === '/' ? '/index.html' : pathname)
  );

  if (file !== path.join(ROOT,'index.html') &&
      !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  fs.readFile(file,(err,data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Bulunamadı');
    }

    res.writeHead(200,{
      'Content-Type':mime[path.extname(file)] ||
        'application/octet-stream',
      'Cache-Control':'no-store'
    });
    res.end(data);
  });
}).listen(PORT,'0.0.0.0',() =>
  console.log('Adam Asmaca çalışıyor: ' + PORT)
);

setInterval(() => {
  for (const [code,r] of rooms)
    if (Date.now() - r.created > 86400000)
      rooms.delete(code);
},3600000).unref();
