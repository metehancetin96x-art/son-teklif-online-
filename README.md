# 🔨 SON TEKLİF — Çok oyunculu açık artırma oyunu

## 1. Kurulumsuz, hemen oyna (tek telefon/bilgisayar)

`tek-cihazda-oyna.html` dosyasını Chrome, Safari veya başka bir tarayıcıda aç.
Oyuncuların adlarını ve ortak başlangıç bütçesini gir, oyuna başla.
Her tur cihazı sıradaki oyuncuya verip diğerlerinin bakmamasını sağla.

## 2. Herkes kendi telefonundan oynasın (oda koduyla)

Node.js 18+ gerekir. Terminalde bu klasörde:

```bash
node server.js
```

Bilgisayar üzerinden `http://localhost:3000` adresini aç.
Aynı Wi-Fi ağındaki telefonlar `http://BILGISAYARIN-YEREL-IP-ADRESI:3000` adresini açabilir.
Örn. `http://192.168.1.50:3000` (bu sadece örnektir, kendi IP adresin farklıdır).
Uzak şehirlerden katılım için bu Node.js uygulamasını HTTPS sunan bir Node.js hosting sağlayıcısına dağıt; servis başlatma komutu `node server.js`, ortam portu `PORT`.

### Nasıl oynanır?

1. Bir oyuncu oda oluşturur, oda kodunu paylaşır.
2. 2–6 kişi katılır. Herkes aynı bütçeyle başlar (varsayılan 100.000 TL).
3. Oda sahibi oyunu başlatır. Her turda ev eşyalarından bir ürün çıkar.
4. Oyuncular aynı anda gizli teklifler gönderir. En yüksek teklifi veren ürünü satın alır ve ödemeyi bütçesinden düşer.
5. Eşit teklif verilirse kazanan rastgele belirlenir. 0 TL teklif geçerlidir; bu, herkesin tam 5 eşya alabilmesini sağlar.
6. Her oyuncu 5 ürün alınca oyun biter. En yüksek **toplam tahmini ürün değeri** kazanan olur (eşitlikte kalan bütçe belirleyicidir).

**Notlar:** Satış bedeli ve tahmini ürün değeri farklıdır. Herkes 5 ürün alır ama her oyuncu her ihaleyi kazanmaz. Bir oyuncu 5 ürüne ulaştığında diğer turlarda teklif veremez. Oyun odaları sunucunun belleğinde tutulur: sunucu yeniden başlarsa mevcut odalar sıfırlanır. 24 saatten eski odalar temizlenir. Her oda azami 6 kişi içindir. Oyun parası gerçekte geçerli değildir.

## Dosyalar

- `tek-cihazda-oyna.html`: çevrim dışı, tek dosyalık sürüm
- `server.js`: gerçek çok oyunculu oda sunucusu (ek paket gerektirmez)
- `public/index.html`, `public/app.js`, `public/style.css`: oyuncuların açtığı mobil uyumlu web arayüzü
