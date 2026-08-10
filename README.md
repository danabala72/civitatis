# Civitatis Provider Starter

Starter project untuk automation Civitatis Provider menggunakan Node.js + JavaScript + Puppeteer.

## Tujuan tahap pertama

Project ini sengaja dibuat minimal:

1. Jalankan dengan `npm start`
2. Puppeteer membuka browser
3. Browser memakai persistent profile
4. Membuka halaman Civitatis Provider
5. Belum melakukan login automation
6. OTP nantinya diinput manual melalui terminal
7. Setelah flow login stabil, baru ditambahkan session detection dan automation booking

## Install

```bash
npm install
```

Buat `.env`:

```bash
cp .env.example .env
```

Isi credential jika diperlukan.

## Run

```bash
npm start
```

Browser akan berjalan non-headless karena:

```env
BROWSER_HEADLESS=false
```

Profile browser disimpan di:

```text
data/browser-profile
```

Jangan masukkan directory tersebut ke Git.

## Struktur

```text
civitatis-provider/
├── package.json
├── .env
├── .env.example
├── .gitignore
├── README.md
├── data/
│   └── browser/
└── src/
    ├── index.js
    ├── config.js
    ├── browser/
    │   └── browser-manager.js
    ├── session/
    │   └── session-manager.js
    └── civitatis/
        └── civitatis-provider.js
```

## Rencana pengembangan

```text
START
  ↓
Launch persistent browser
  ↓
Open Civitatis Provider
  ↓
Detect session
  ├── valid → skip login
  └── invalid
       ↓
     login
       ↓
   OTP required?
       ├── no → authenticated
       └── yes
            ↓
      terminal input OTP
            ↓
      submit OTP
            ↓
       verify session
            ↓
        authenticated
```

Gmail API belum digunakan pada starter ini.
