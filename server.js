
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const rooms = new Map();
const MAX_WRONG = 6;

const WORDS = {
  'Hayvanlar': {
    Kolay: ['KEDİ','KÖPEK','ASLAN','BALIK','TAVŞAN','AYI','İNEK','KUŞ','FARE','ARI','FİL'],
    Orta: ['PAPAĞAN','PENGUEN','ZÜRAFA','KAPLAN','YUNUS','TİMSAH','KELEBEK','KARTAL','LEYLEK'],
    Zor: ['GERGEDAN','KAPLUMBAĞA','BUKALEMUN','ORNİTORENK','MÜREKKEP BALIĞI','DENİZATI']
  },
  'Ülkeler': {
    Kolay: ['TÜRKİYE','ÇİN','İRAN','MISIR','KANADA','FRANSA','İTALYA','YUNANİSTAN'],
    Orta: ['PORTEKİZ','BREZİLYA','NORVEÇ','ARJANTİN','JAPONYA','İSPANYA','HOLLANDA'],
    Zor: ['AZERBAYCAN','KIRGIZİSTAN','MOZAMBİK','MADAGASKAR','ENDONEZYA','ÖZBEKİSTAN']
  },
  'Şehirler': {
    Kolay: ['ANKARA','İZMİR','BURSA','ADANA','KONYA','VAN','RİZE','BOLU','KARS','ORDU','SİVAS'],
    Orta: ['İSTANBUL','ANTALYA','TRABZON','SAMSUN','EDİRNE','KAYSERİ','MALATYA','DENİZLİ','SAKARYA'],
    Zor: ['ESKİŞEHİR','ÇANAKKALE','GAZİANTEP','KAHRAMANMARAŞ','AFYONKARAHİSAR','KIRKLARELİ','GÜMÜŞHANE','ŞANLIURFA']
  },
  'Teknoloji': {
    Kolay: ['ROBOT','TABLET','FARE','EKRAN','KAMERA','RADYO'],
    Orta: ['BİLGİSAYAR','KLAVYE','MONİTÖR','İNTERNET','YAZILIM','KULAKLIK'],
    Zor: ['YAPAY ZEKA','MİKROİŞLEMCİ','SİBER GÜVENLİK','ALGORİTMA','ŞİFRELEME']
  },
  'Yemekler': {
    Kolay: ['PİLAV','KÖFTE','ÇORBA','KEK','MANTI','BÖREK'],
    Orta: ['LAHMACUN','BAKLAVA','MENEMEN','İSKENDER','KÜNEFE','DONDURMA'],
    Zor: ['KARNIYARIK','İMAMBAYILDI','HÜNKAR BEĞENDİ','SU BÖREĞİ','İÇLİ KÖFTE']
  },
  'Spor': {
    Kolay: ['FUTBOL','TENİS','YÜZME','GOLF','BOKS','KOŞU'],
    Orta: ['BASKETBOL','VOLEYBOL','BİSİKLET','ATLETİZM','HENTBOL'],
    Zor: ['BADMİNTON','ÜÇLÜ YARIŞ','ESKRİM','YÖN BULMA','BEŞLİ YARIŞ']
  },
  'Filmler': {
    Kolay: ['TİTANİK','HABABAM SINIFI','GORA','AROG','BABAM VE OĞLUM'],
    Orta: ['GLADYATÖR','BAŞLANGIÇ','YILDIZ SAVAŞLARI','EŞKIYA','KIŞ UYKUSU'],
    Zor: ['ESARETİN BEDELİ','YÜZÜKLERİN EFENDİSİ','AKIL OYUNLARI','BİR ZAMANLAR ANADOLUDA']
  },
  'Diziler': {
    Kolay: ['AVRUPA YAKASI','EZEL','ARKA SOKAKLAR','ÇUKUR'],
    Orta: ['LEYLA İLE MECNUN','KURTLAR VADİSİ','ŞAHSİYET','İŞLER GÜÇLER'],
    Zor: ['BEHZAT Ç','MASUM','BİR BAŞKADIR','MUHTEŞEM YÜZYIL']
  },
  'Müzik': {
    Kolay: ['GİTAR','PİYANO','DAVUL','FLÜT','KEMAN'],
    Orta: ['SAKSAFON','KLARNET','AKORDEON','TROMPET','ÇELLO'],
    Zor: ['KONTRBAS','KLAVSEN','KONÇERTO','SENFONİ','METRONOM']
  },
  'Meslekler': {
    Kolay: ['DOKTOR','ÖĞRETMEN','POLİS','AŞÇI','PİLOT'],
    Orta: ['MÜHENDİS','MİMAR','AVUKAT','ECZACI','GAZETECİ'],
    Zor: ['ARKEOLOG','ASTRONOT','METEOROLOG','NÖROLOG','PALEONTOLOG']
  },
  'Doğa': {
    Kolay: ['DENİZ','ORMAN','DAĞ','GÖL','NEHİR'],
    Orta: ['YANARDAĞ','ŞELALE','BUZUL','HORTUM','MERCAN'],
    Zor: ['BİYOÇEŞİTLİLİK','FOTOSENTEZ','EKOSİSTEM','DONMUŞ TOPRAK']
  },
  'Tarih': {
    Kolay: ['OSMANLI','ROMA','KALE','KRAL','SARAY'],
    Orta: ['RÖNESANS','CUMHURİYET','FETİH','İMPARATORLUK'],
    Zor: ['MEŞRUTİYET','YENİDEN DOĞUŞ','SANAYİ DEVRİMİ','HELENİSTİK']
  },
  'Coğrafya': {
    Kolay: ['KITA','ADA','OVA','DENİZ','VADİ'],
    Orta: ['YARIMADA','EKVATOR','MERİDYEN','PLATO','BOĞAZ'],
    Zor: ['TAKIMADA','STRATOSFER','KARSTİK','JEOMORFOLOJİ']
  },
  'Bilim': {
    Kolay: ['ATOM','IŞIK','SES','ENERJİ','HÜCRE'],
    Orta: ['MOLEKÜL','DENEY','KÜTLEÇEKİM','MİKROSKOP','ELEMENT'],
    Zor: ['TERMODİNAMİK','ELEKTROMANYETİZMA','KUANTUM','ASTROFİZİK']
  },
  'Edebiyat': {
    Kolay: ['ŞİİR','ROMAN','MASAL','ÖYKÜ','KİTAP'],
    Orta: ['DESTAN','HİKAYE','BENZETME','ELEŞTİRİ','UYAK'],
    Zor: ['ALEGORİ','POSTMODERNİZM','BİLİNÇ AKIŞI','NATÜRALİZM']
  },
  'Mitoloji': {
    Kolay: ['ZEUS','HERA','THOR','LOKİ','ODİN'],
    Orta: ['POSEİDON','ATHENA','APOLLON','MEDUSA','HADES'],
    Zor: ['PROMETHEUS','PERSEPHONE','MİNOTOR','HERAKLES']
  },
  'Markalar': {
    Kolay: ['ÜLKER','ARÇELİK','BİM','VESTEL','TOFAŞ'],
    Orta: ['TÜRK TELEKOM','TURKCELL','TÜRK HAVA YOLLARI','ASELSAN'],
    Zor: ['ROKETSAN','TUSAŞ','ŞİŞECAM','ANADOLU SİGORTA']
  },
  'Genel Kültür': {
    Kolay: ['GÜNEŞ','AY','DÜNYA','SAAT','TAKVİM'],
    Orta: ['PİRAMİT','DEMOKRASİ','GALAKSİ','OKYANUS','SATÜRN'],
    Zor: ['ANTARKTİKA','FİLOZOF','HİYEROGLİF','KARA DELİK','NOBEL ÖDÜLÜ']
  }
};

const upper = s => String(s || '').trim().toLocaleUpperCase('tr-TR');
const uid = () => crypto.randomBytes(16).toString('hex');

function reply(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function currentPlayer(r) {
  return r.players[r.turn % r.players.length];
}

function advanceTurn(r) {
  r.turn = (r.turn + 1) % r.players.length;
}

function hiddenCount(r) {
  return [...r.word].filter(c =>
    c !== ' ' && !r.guessed.includes(c)
  ).length;
}

function finishRound(r, player, solved) {
  r.status = 'result';
  r.winnerId = solved ? player.id : null;
  r.revealedWord = r.word;
}

function startRound(r) {
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
  r.turn = crypto.randomInt(r.players.length);
  r.winnerId = null;
  r.revealedWord = null;
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
    difficulty: r.difficulty,
    round: r.round,
    roundLimit: r.roundLimit,
    wrong: r.wrong,
    maxWrong: MAX_WRONG,
    guessed: r.guessed,
    masked: r.word
      ? [...r.word].map(c =>
          c === ' ' ? ' ' :
          r.guessed.includes(c) ? c : '_'
        ).join('')
      : null,
    turnId: r.status === 'playing' ? currentPlayer(r).id : null,
    winnerId: r.winnerId,
    revealedWord: r.revealedWord,
    message: r.message,
    custom: r.custom,
    wordCount: r.words.length
  };
}

function removePlayer(r, player) {
  const index = r.players.findIndex(p => p.id === player.id);
  if (index < 0) return;

  const wasTurn = r.status === 'playing' && r.turn === index;

  r.players.splice(index, 1);

  if (r.players.length === 0) {
    rooms.delete(r.code);
    return;
  }

  if (r.hostId === player.id) {
    r.hostId = r.players[0].id;
  }

  if (r.status === 'playing') {
    if (r.players.length === 1) {
      r.status = 'finished';
      r.message = 'Diğer oyuncular ayrıldı. Oyun sona erdi.';
    } else {
      if (index < r.turn) r.turn--;
      if (r.turn >= r.players.length) r.turn = 0;

      if (wasTurn) {
        r.message = `${player.name} oyundan ayrıldı. Sıra sonraki oyuncuda.`;
      }
    }
  }

  if (r.status === 'result' && r.winnerId === player.id) {
    r.winnerId = null;
  }
}

function api(res, b) {
  const action = b.action;
  let r;

  if (action === 'create') {
    const name = String(b.name || '').trim().slice(0, 22);
    if (!name) return reply(res, 400, {error: 'Adını gir.'});

    let code;
    do {
      code = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (rooms.has(code));

    const p = {id: uid(), token: uid(), name, score: 0};

    r = {
      code,
      hostId: p.id,
      players: [p],
      status: 'lobby',
      category: 'Hayvanlar',
      difficulty: 'Orta',
      words: WORDS.Hayvanlar.Orta,
      custom: false,
      round: 0,
      roundLimit: 5,
      turn: 0,
      word: null,
      guessed: [],
      wrong: 0,
      used: [],
      winnerId: null,
      revealedWord: null,
      message: '',
      created: Date.now()
    };

    rooms.set(code, r);

    return reply(res, 200, {
      code,
      token: p.token,
      state: view(r, p.token)
    });
  }

  r = rooms.get(upper(b.code));

  if (!r) return reply(res, 404, {error: 'Oda bulunamadı.'});

  if (action === 'join') {
    if (r.status !== 'lobby')
      return reply(res, 409, {error: 'Oyun başladı.'});

    if (r.players.length >= 6)
      return reply(res, 409, {error: 'Oda dolu.'});

    const name = String(b.name || '').trim().slice(0, 22);

    if (!name || r.players.some(p =>
      p.name.toLocaleLowerCase('tr-TR') ===
      name.toLocaleLowerCase('tr-TR')
    )) {
      return reply(res, 400, {
        error: 'Farklı bir oyuncu adı gir.'
      });
    }

    const p = {id: uid(), token: uid(), name, score: 0};
    r.players.push(p);

    return reply(res, 200, {
      code: r.code,
      token: p.token,
      state: view(r, p.token)
    });
  }

  const p = r.players.find(x => x.token === b.token);

  if (!p)
    return reply(res, 403, {error: 'Oturum geçersiz.'});

  if (action === 'state')
    return reply(res, 200, {state: view(r, p.token)});

  if (action === 'leave') {
    removePlayer(r, p);
    return reply(res, 200, {success: true});
  }

  if (action === 'configure') {
    if (p.id !== r.hostId || r.status !== 'lobby')
      return reply(res, 403, {
        error: 'Yalnızca oda sahibi ayarları değiştirebilir.'
      });

    const limit = Number(b.roundLimit);
    const difficulty = String(b.difficulty || 'Orta');

    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      return reply(res, 400, {error: 'Tur sayısı 1–20 olmalı.'});

    if (!['Kolay', 'Orta', 'Zor'].includes(difficulty))
      return reply(res, 400, {error: 'Geçerli zorluk seç.'});

    if (b.category === 'Özel') {
      const title = String(b.customTitle || '').trim().slice(0, 40);

      const words = String(b.customWords || '')
        .split(/\r?\n/)
        .map(upper)
        .filter(w => /^[A-ZÇĞİÖŞÜ ]{2,35}$/.test(w));

      const unique = [...new Set(words)].slice(0, 100);

      if (!title || unique.length < 2)
        return reply(res, 400, {
          error: 'Özel kategori adı ve en az 2 kelime gir.'
        });

      r.category = title;
      r.words = unique;
      r.custom = true;
    } else {
      if (!WORDS[b.category])
        return reply(res, 400, {error: 'Kategori seç.'});

      r.category = b.category;
      r.words = WORDS[b.category][difficulty];
      r.custom = false;
    }

    r.difficulty = difficulty;
    r.roundLimit = limit;

    return reply(res, 200, {state: view(r, p.token)});
  }

  if (action === 'start') {
    if (p.id !== r.hostId || r.status !== 'lobby' ||
        r.players.length < 2)
      return reply(res, 409, {
        error: 'Başlamak için en az 2 oyuncu gerekli.'
      });

    startRound(r);
    return reply(res, 200, {state: view(r, p.token)});
  }

  if (action === 'guess') {
    if (r.status !== 'playing')
      return reply(res, 409, {error: 'Tahminler kapalı.'});

    if (currentPlayer(r).id !== p.id)
      return reply(res, 403, {error: 'Sıra sende değil.'});

    const value = upper(b.value);

    if (b.kind === 'letter') {
      if (!/^[A-ZÇĞİÖŞÜ]$/.test(value))
        return reply(res, 400, {error: 'Tek harf gir.'});

      if (r.guessed.includes(value))
        return reply(res, 409, {
          error: 'Bu harf zaten denendi.'
        });

      r.guessed.push(value);

      if (r.word.includes(value)) {
        const count = [...r.word].filter(c => c === value).length;
        p.score += count * 10;
        r.message = `${p.name} doğru harf buldu! +${count * 10} puan`;
      } else {
        r.wrong++;
        r.message = `${p.name} yanlış harf söyledi.`;
      }

      if (hiddenCount(r) === 0) {
        p.score += 50;
        finishRound(r, p, true);
        r.message = `${p.name} kelimeyi tamamladı! +50 puan`;
      } else if (r.wrong >= MAX_WRONG) {
        p.score -= 100;
        finishRound(r, p, false);
        r.message = `${p.name} adamı astırdı! −100 puan`;
      } else {
        advanceTurn(r);
      }

    } else if (b.kind === 'word') {
      if (value.length < 2 || value.length > 35)
        return reply(res, 400, {error: 'Geçerli kelime gir.'});

      if (value === r.word) {
        const points = 100 + hiddenCount(r) * 10;
        p.score += points;
        finishRound(r, p, true);
        r.message = `${p.name} kelimeyi bildi! +${points} puan`;
      } else {
        r.wrong++;

        if (r.wrong >= MAX_WRONG) {
          p.score -= 100;
          finishRound(r, p, false);
          r.message = `${p.name} adamı astırdı! −100 puan`;
        } else {
          r.message = `${p.name} yanlış kelime tahmin etti.`;
          advanceTurn(r);
        }
      }
    } else {
      return reply(res, 400, {error: 'Geçersiz tahmin.'});
    }

    return reply(res, 200, {state: view(r, p.token)});
  }

  if (action === 'next') {
    if (p.id !== r.hostId || r.status !== 'result')
      return reply(res, 403, {
        error: 'Sonraki turu oda sahibi açabilir.'
      });

    startRound(r);
    return reply(res, 200, {state: view(r, p.token)});
  }

  return reply(res, 400, {error: 'Bilinmeyen işlem.'});
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

http.createServer((req, res) => {
  let url;

  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return reply(res, 400, {error: 'Geçersiz adres.'});
  }

  if (url.pathname === '/api') {
    if (req.method !== 'POST')
      return reply(res, 405, {error: 'POST gerekli.'});

    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 40000) req.destroy();
    });

    req.on('end', () => {
      try {
        api(res, JSON.parse(body || '{}'));
      } catch (e) {
        console.error(e);
        if (!res.headersSent)
          reply(res, 500, {error: 'Sunucu hatası.'});
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

  if (file !== path.join(ROOT, 'index.html') &&
      !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Bulunamadı');
    }

    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ||
        'application/octet-stream',
      'Cache-Control': 'no-store'
    });

    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () =>
  console.log('Adam Asmaca çalışıyor: ' + PORT)
);

setInterval(() => {
  for (const [code, r] of rooms) {
    if (Date.now() - r.created > 86400000)
      rooms.delete(code);
  }
}, 3600000).unref();
