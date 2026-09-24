/* ════════════════════════════════════════════════════════════════════
   MetalDeck SR-79 — مسجّل الشاشة المكتبي
   النسخة أحادية الملف: (الرئيسية + Preload + واجهة الجهاز) في ملف واحد
   واجهة معدنية كلاسيكية · يعمل أوفلاين 100% · نظام Windows
   التشغيل:  npx electron metaldeck.js
   ════════════════════════════════════════════════════════════════════ */
'use strict';

const isMain    = process.type === 'browser';
const isPreload = !isMain && process.contextIsolated === true;

/* ════════════════════════════════════════════════════════════════════
   ① العملية الرئيسية (Main Process)
   ════════════════════════════════════════════════════════════════════ */
if (isMain) {

  const {
    app, BrowserWindow, ipcMain, globalShortcut,
    shell, session, desktopCapturer, Menu
  } = require('electron');
  const path = require('path');
  const fs   = require('fs');

  let win = null;
  let allowClose = false;

  /* طابع زمني لأسماء الملفات */
  function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
           `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  }

  /* مجلد الحفظ المحلي */
  function saveDir() {
    const dir = path.join(app.getPath('videos'), 'MetalDeck Recordings');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function writeFile(folder, prefix, ext, data) {
    const dir = path.join(saveDir(), folder);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${prefix}_${stamp()}.${ext}`);
    fs.writeFileSync(file, Buffer.from(data));
    return file;
  }

  /* ────────────────────────────────────────────────────────────────
     واجهة الجهاز كاملة (HTML + CSS + JS) مضمّنة داخل هذا الملف.
     تُكتب عند الإقلاع إلى مجلد userData ثم تُحمَّل محليًا.
     ──────────────────────────────────────────────────────────────── */
  const HTML = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src blob: mediastream:;">
<title>MetalDeck SR-79 — مسجّل الشاشة المكتبي</title>
<style>
:root{
  --metal-hi:#565b63; --metal:#33363c; --metal-lo:#212327;
  --groove:#101114; --edge:#0b0c0e;
  --silver:#c9ccd1; --label:#9aa0a8; --label-dim:#6f757d;
  --red:#ff3b2c; --amber:#ffb43a; --green:#52f57d;
  --lcd:#6cf58a; --seg:#ff5a45;
}
*{ box-sizing:border-box; user-select:none; -webkit-user-select:none; margin:0; padding:0; }
.mini-lcd,#logText,#dirLabel,.nm{ user-select:text; }
body{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:18px; overflow:auto; color:var(--silver);
  font-family:"Segoe UI", Tahoma, Arial, sans-serif;
  background:
    radial-gradient(1100px 650px at 50% -12%, #2e3136 0%, transparent 60%),
    radial-gradient(900px 500px at 88% 112%, #23262a 0%, transparent 55%),
    #141518;
}
:focus-visible{ outline:2px solid var(--amber); outline-offset:2px; border-radius:4px; }
.hidden{ display:none !important; }

/* هيكل الجهاز المعدني */
#device{
  width:min(1080px,100%); position:relative;
  border-radius:16px; padding:0 20px 14px;
  border:1px solid var(--edge);
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0 1px, transparent 1px 3px),
    linear-gradient(175deg,#43474d 0%,#2c2f34 22%,#24262b 60%,#1c1e22 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22), inset 0 -2px 0 rgba(0,0,0,.55),
    inset 2px 0 0 rgba(255,255,255,.05),
    0 26px 60px rgba(0,0,0,.65), 0 4px 14px rgba(0,0,0,.5);
}
.screw{
  position:absolute; width:15px; height:15px; border-radius:50%; z-index:5;
  background:radial-gradient(circle at 35% 30%, #cfd4da, #8a8f96 45%, #565b62 72%, #2b2e33);
  box-shadow:inset 0 -1px 2px rgba(0,0,0,.85), 0 1px 1px rgba(255,255,255,.15);
}
.screw::after{
  content:''; position:absolute; left:16%; right:16%; top:50%; height:2px; margin-top:-1px;
  background:#22252a; border-radius:1px; transform:rotate(var(--rot,25deg));
  box-shadow:0 1px 0 rgba(255,255,255,.25);
}
.engraved{
  font-size:10px; font-weight:800; letter-spacing:.22em; text-transform:uppercase;
  color:var(--label); font-family:"Arial Narrow", Arial, sans-serif;
  text-shadow:0 -1px 0 rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.10);
}
.sub{ font-size:11px; color:var(--label-dim); margin-inline-start:auto; }

/* شريط العنوان */
#titlebar{
  display:flex; align-items:center; gap:16px; height:58px;
  -webkit-app-region:drag;
  border-bottom:1px solid rgba(0,0,0,.55);
  box-shadow:0 1px 0 rgba(255,255,255,.07);
}
.brand{ display:flex; align-items:center; gap:11px; }
.badge{
  width:34px; height:34px; border-radius:50%; display:grid; place-items:center;
  color:var(--red); font-size:15px;
  background:radial-gradient(circle at 50% 38%, #3c4046, #1d1f23 75%);
  box-shadow:inset 0 2px 4px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.12),
             0 1px 0 rgba(255,255,255,.1), 0 0 10px rgba(255,59,44,.25);
}
.brand-text h1{ font-size:17px; letter-spacing:.16em; color:#dfe2e6; font-weight:800;
  text-shadow:0 -1px 0 rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); }
.brand-text h1 span{ color:var(--amber); }
.brand-text p{ font-size:10.5px; color:var(--label-dim); margin-top:1px; }
.tb-spec{ margin-inline-start:auto; }
.tb-led{ display:flex; align-items:center; gap:6px; }
.tb-led label{ font-size:9px; }
.winbtns{ display:flex; gap:8px; -webkit-app-region:no-drag; }
.winbtns button{
  width:32px; height:23px; border-radius:5px; cursor:pointer; font-size:12px;
  border:1px solid var(--groove); color:#c8ccd2;
  background:linear-gradient(180deg,#4a4e55,#2e3136);
  box-shadow:0 2px 0 var(--groove), inset 0 1px 0 rgba(255,255,255,.25);
  transition:.08s;
}
.winbtns button:active{ transform:translateY(2px); box-shadow:0 0 0 var(--groove); }
.winbtns #btnClose:hover{ background:linear-gradient(180deg,#e05545,#a72a1d); color:#fff; }

/* شبكة اللوحة */
#deck{ display:grid; grid-template-columns:1.55fr 1fr; gap:14px; padding-top:16px; direction:ltr; }
#monitor-col,#rack{ display:flex; flex-direction:column; gap:14px; min-width:0; }

.panel{
  position:relative; border-radius:10px; padding:12px 14px 14px;
  border:1px solid #131417;
  background:linear-gradient(180deg,#35383e,#26292e 55%,#202226);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.14), inset 0 -1px 0 rgba(0,0,0,.5),
             0 6px 14px rgba(0,0,0,.35);
}
.panel-head{
  display:flex; align-items:baseline; gap:10px;
  padding-bottom:8px; margin-bottom:12px;
  border-bottom:1px solid rgba(0,0,0,.45);
  box-shadow:0 1px 0 rgba(255,255,255,.06);
}
.head-right{ margin-left:auto; display:flex; align-items:center; gap:6px; }

/* شاشة CRT */
.crt-wrap{
  padding:12px; border-radius:18px;
  background:linear-gradient(180deg,#191b1e,#0e0f11);
  box-shadow:inset 0 2px 8px rgba(0,0,0,.85), 0 1px 0 rgba(255,255,255,.08);
}
.crt{
  position:relative; aspect-ratio:16/9; overflow:hidden;
  background:#050607; border-radius:11px; border:1px solid #000;
  box-shadow:inset 0 0 36px rgba(0,0,0,.95);
}
#preview{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:#000; }
.static-layer{
  position:absolute; inset:0; opacity:.55; background-size:220% 220%;
  animation:staticJitter .45s steps(3) infinite; transition:opacity .45s;
}
.crt.live .static-layer{ opacity:0; }
@keyframes staticJitter{
  0%{background-position:0 0} 33%{background-position:60% 35%}
  66%{background-position:25% 80%} 100%{background-position:90% 10%}
}
.rollbar{
  position:absolute; left:0; right:0; height:64px; top:-70px; pointer-events:none;
  background:linear-gradient(180deg,transparent,rgba(255,255,255,.05),transparent);
  animation:roll 7s linear infinite;
}
@keyframes roll{ to{ top:110%; } }
.scanlines{
  position:absolute; inset:0; pointer-events:none; z-index:3;
  background:repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px);
}
.vignette{
  position:absolute; inset:0; pointer-events:none; z-index:3;
  background:radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,.55) 100%);
}
.snap-flash{ position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; z-index:4; }
.snap-flash.go{ animation:flash .38s ease-out; }
@keyframes flash{ 0%{opacity:.95} 100%{opacity:0} }
.osd{ position:absolute; inset:0; z-index:3; pointer-events:none;
  font-family:Consolas, monospace; font-size:12px; letter-spacing:.12em; }
.osd #osdStatus{ position:absolute; top:10px; left:12px; }
.osd #osdSrc{ position:absolute; bottom:10px; left:12px; font-size:10px; color:#7f8894; }
.osd #osdClock{ position:absolute; bottom:10px; right:12px; color:#5f6873; }
.osd .dim{ color:#5f6873; }
.osd .red{ color:#ff5140; text-shadow:0 0 8px rgba(255,60,40,.9); animation:blinkTxt 1s steps(2,start) infinite; }
.osd .amber{ color:var(--amber); text-shadow:0 0 8px rgba(255,180,58,.8); }
@keyframes blinkTxt{ 50%{ opacity:.15; } }

/* أزرار النقل الميكانيكية */
.transport{ display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.key{ border:none; background:transparent; cursor:pointer; padding:0; }
.key .key-top{
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
  min-width:80px; padding:13px 12px; border-radius:9px;
  font-size:16px; font-weight:800; letter-spacing:.08em; color:#d7dade;
  text-shadow:0 -1px 0 rgba(0,0,0,.7);
  border:1px solid #121316; border-top-color:#6a7078;
  background:linear-gradient(180deg,var(--metal-hi),#34383e 48%,#272a2f);
  box-shadow:0 6px 0 var(--groove), 0 10px 16px rgba(0,0,0,.55),
             inset 0 1px 0 rgba(255,255,255,.28);
  transition:transform .07s, box-shadow .07s;
}
.key .key-top small{ font-size:9px; letter-spacing:.2em; color:#8b9097; font-weight:700; }
.key:active .key-top, .key.pressed .key-top{
  transform:translateY(5px);
  box-shadow:0 1px 0 var(--groove), 0 3px 6px rgba(0,0,0,.5),
             inset 0 2px 6px rgba(0,0,0,.45);
}
.key.disabled .key-top{ opacity:.45; }
.key.wide{ width:100%; margin-top:10px; }
.key.small .key-top{ min-width:0; width:100%; padding:10px; margin-top:2px; }

/* زر REC الأحمر */
.rec-wrap{ display:flex; flex-direction:column; align-items:center; gap:6px; position:relative; padding:0 8px; }
.rec-glow{
  position:absolute; top:50%; left:50%; width:120px; height:120px;
  transform:translate(-50%,-58%); border-radius:50%; pointer-events:none;
  background:radial-gradient(circle, rgba(255,50,30,.5), transparent 70%);
  opacity:0; transition:.35s;
}
.rec-wrap:has(#btnRec.armed) .rec-glow{ opacity:1; animation:glowpulse 1.2s ease-in-out infinite; }
@keyframes glowpulse{ 50%{ transform:translate(-50%,-58%) scale(1.18); opacity:.65; } }
#btnRec{
  width:86px; height:86px; border-radius:50%; border:none; cursor:pointer; position:relative;
  background:radial-gradient(circle at 50% 44%, #ff6a55 0%, #e03423 42%, #9c130b 78%, #7a0d06 100%);
  box-shadow:
    0 0 0 5px #1a1c1f, 0 0 0 7px #43474d, 0 0 0 8px var(--groove),
    0 9px 16px rgba(0,0,0,.55),
    inset 0 -7px 12px rgba(0,0,0,.45), inset 0 5px 7px rgba(255,255,255,.35);
  transition:transform .09s, box-shadow .09s;
}
#btnRec::after{
  content:''; position:absolute; top:14%; left:22%; width:34%; height:20%;
  border-radius:50%; background:radial-gradient(ellipse, rgba(255,255,255,.55), transparent 70%);
}
#btnRec:active, #btnRec.armed{ transform:translateY(4px);
  box-shadow:
    0 0 0 5px #1a1c1f, 0 0 0 7px #43474d, 0 0 0 8px var(--groove),
    0 3px 8px rgba(0,0,0,.55),
    inset 0 -3px 8px rgba(0,0,0,.55), inset 0 3px 5px rgba(255,255,255,.25);
}
.led-cluster{ display:flex; flex-direction:column; gap:7px; padding-left:10px;
  border-left:1px solid rgba(0,0,0,.4); box-shadow:-1px 0 0 rgba(255,255,255,.05); }
.led-cluster div{ display:flex; align-items:center; gap:7px; }
.led-cluster label{ font-size:8.5px; letter-spacing:.18em; color:var(--label-dim); font-weight:700; }

/* مصابيح LED */
.led{
  width:11px; height:11px; border-radius:50%; display:inline-block; flex:none;
  background:#2a2124; box-shadow:inset 0 1px 3px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.08);
  transition:.15s;
}
.led.tiny{ width:8px; height:8px; }
.led.green.on{ background:var(--green); box-shadow:0 0 8px var(--green), 0 0 20px rgba(82,245,125,.55), inset 0 0 2px #fff; }
.led.red.on{   background:var(--red);   box-shadow:0 0 8px var(--red),   0 0 20px rgba(255,59,44,.6); }
.led.amber.on{ background:var(--amber); box-shadow:0 0 8px var(--amber), 0 0 18px rgba(255,180,58,.55); }
.led.blink{ animation:ledblink .9s steps(2,start) infinite; }
@keyframes ledblink{ 50%{ background:#2a2124; box-shadow:inset 0 1px 3px rgba(0,0,0,.9); } }

/* العداد الرقمي */
.seg-display{
  position:relative; text-align:center; direction:ltr;
  font-family:Consolas,"Courier New",monospace; font-size:44px; font-weight:700; letter-spacing:.06em;
  padding:10px 14px; border-radius:8px; border:1px solid #000;
  background:linear-gradient(180deg,#0d0505,#1a0b0a 60%,#120707);
  box-shadow:inset 0 2px 8px rgba(0,0,0,.9), inset 0 0 26px rgba(255,40,20,.06),
             0 1px 0 rgba(255,255,255,.07);
}
.seg-display .ghost{ position:absolute; inset:10px 14px; color:rgba(255,90,70,.07); }
#timer{ position:relative; color:var(--seg);
  text-shadow:0 0 6px rgba(255,70,45,.95), 0 0 26px rgba(255,70,45,.45); }
#timer.blink{ animation:blinkTxt 1s steps(2,start) infinite; }
.status-line{
  margin-top:9px; padding:6px 10px; border-radius:6px; text-align:center;
  font-size:13px; color:var(--lcd);
  background:linear-gradient(180deg,#0f1a12,#12241a 60%,#0d1811);
  border:1px solid #000; box-shadow:inset 0 2px 6px rgba(0,0,0,.85);
  text-shadow:0 0 7px rgba(108,245,138,.55);
}

/* مؤشر VU */
.vu{ display:flex; gap:4px; height:16px; margin-top:11px; padding:5px 7px; border-radius:6px;
  background:#101215; box-shadow:inset 0 2px 6px rgba(0,0,0,.85), 0 1px 0 rgba(255,255,255,.06); }
.vu i{ flex:1; border-radius:2px; background:#20262b;
  box-shadow:inset 0 1px 2px rgba(0,0,0,.8); transition:background .05s, box-shadow .05s; }
.vu i:nth-child(-n+8){ --c:#3fe36b; }
.vu i:nth-child(n+9):nth-child(-n+11){ --c:var(--amber); }
.vu i:nth-child(n+12){ --c:#ff4436; }
.vu i.on{ background:var(--c); box-shadow:0 0 8px var(--c), inset 0 0 2px rgba(255,255,255,.5); }
.vu-label{ margin-top:7px; text-align:center; font-size:8.5px; }

/* مفاتيح التبديل المعدنية */
.switch-row{ display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:10px; }
.sw-opt{ background:none; border:none; cursor:pointer; font-size:10px; padding:4px 2px; transition:.15s; opacity:.55; }
.sw-opt:hover{ opacity:.85; }
.sw-opt.active{ color:#e8d9b8; opacity:1; text-shadow:0 0 8px rgba(255,200,120,.35); }
.track{
  position:relative; width:72px; height:26px; border-radius:20px; cursor:pointer; flex:none;
  background:linear-gradient(180deg,#0e0f11,#1b1d20);
  box-shadow:inset 0 2px 5px rgba(0,0,0,.85), inset 0 -1px 0 rgba(255,255,255,.06);
}
.track .lever{
  position:absolute; top:3px; left:3px; width:31px; height:20px; border-radius:12px;
  background:linear-gradient(180deg,#c8cdd3,#8d939b 45%,#6a7078);
  box-shadow:0 2px 4px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.75);
  transition:left .18s cubic-bezier(.55,-.3,.45,1.4);
}
.track.right .lever{ left:calc(100% - 34px); }
.track.tiny{ width:52px; height:20px; }
.track.tiny .lever{ width:22px; height:14px; }
.track.tiny.right .lever{ left:calc(100% - 25px); }
.tiny-row{ margin-top:12px; margin-bottom:0; }

/* شاشات LCD */
.mini-lcd{
  margin-top:10px; padding:7px 10px; border-radius:6px; border:1px solid #000;
  direction:ltr; font-family:Consolas,monospace; font-size:12px; color:var(--lcd);
  background:linear-gradient(180deg,#0f1a12,#12241a 60%,#0d1811);
  text-shadow:0 0 6px rgba(108,245,138,.6);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.85), 0 1px 0 rgba(255,255,255,.07);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.mini-lcd.path{ direction:ltr; font-size:11px; margin-top:0; }

/* القرص الدوار */
.knob-zone{ display:flex; align-items:center; gap:16px; }
.knob{
  width:94px; height:94px; border-radius:50%; position:relative; cursor:pointer; flex:none;
  background:radial-gradient(circle at 50% 40%, #575c64, #33363c 60%, #26282d);
  box-shadow:0 8px 14px rgba(0,0,0,.55), 0 0 0 5px #1a1c1f, 0 0 0 6px rgba(255,255,255,.05),
             inset 0 2px 3px rgba(255,255,255,.25), inset 0 -6px 10px rgba(0,0,0,.5);
}
.knob .cap{
  position:absolute; inset:9px; border-radius:50%;
  transform:rotate(var(--rot,-54deg));
  transition:transform .28s cubic-bezier(.34,1.5,.5,1);
  background:conic-gradient(from 210deg, rgba(255,255,255,.14), rgba(0,0,0,.25) 20%,
    rgba(255,255,255,.14) 38%, rgba(0,0,0,.25) 58%, rgba(255,255,255,.14) 78%, rgba(0,0,0,.25));
  box-shadow:inset 0 1px 2px rgba(255,255,255,.3), inset 0 -3px 6px rgba(0,0,0,.5);
}
.knob:active .cap{ filter:brightness(1.08); }
.knob .pointer{
  position:absolute; top:5px; left:50%; width:5px; height:21px; margin-left:-2.5px; border-radius:3px;
  background:linear-gradient(180deg,#ffe0b0,#ff9d3c);
  box-shadow:0 0 9px rgba(255,157,60,.85);
}
.a-labels{ display:grid; grid-template-columns:1fr 1fr; gap:7px; flex:1; }
.a-labels button{
  display:flex; align-items:center; gap:7px; padding:7px 9px; border-radius:7px; cursor:pointer;
  border:1px solid var(--groove); background:linear-gradient(180deg,#24262b,#1b1d21);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07); color:var(--label-dim); transition:.15s;
}
.a-labels button b{ font-size:11px; letter-spacing:.12em; color:#aeb4bb; }
.a-labels button small{ font-size:9.5px; margin-inline-start:auto; }
.a-labels button.active{ border-color:rgba(255,180,58,.4); background:linear-gradient(180deg,#2c2f34,#22252a); }
.a-labels button.active b{ color:#ffd9a0; text-shadow:0 0 8px rgba(255,190,110,.4); }

/* الاختصارات */
.hk-list{ list-style:none; display:flex; flex-direction:column; gap:7px; }
.hk-list li{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding:7px 10px; border-radius:7px;
  background:linear-gradient(180deg,#24262b,#1b1d21);
  border:1px solid var(--groove); box-shadow:inset 0 1px 0 rgba(255,255,255,.07);
}
.hk-name{ font-size:12px; color:#aeb4bb; }
.combo{
  direction:ltr; font-family:Consolas,monospace; font-size:12px; color:#ffd9a0;
  background:#0e0d0b; border:1px solid #000; border-radius:4px; padding:4px 10px;
  cursor:pointer; min-width:112px; text-align:center;
  box-shadow:inset 0 2px 4px rgba(0,0,0,.8);
  text-shadow:0 0 6px rgba(255,190,110,.5);
}
.combo.listening{ color:#ff5a45; animation:blinkTxt .8s steps(2,start) infinite; }

/* الملفات */
.counter{
  display:flex; justify-content:space-between; align-items:center;
  margin-top:10px; padding:7px 11px; border-radius:6px; direction:ltr;
  background:#0e0f11; box-shadow:inset 0 2px 5px rgba(0,0,0,.85);
  font-family:Consolas,monospace; font-size:14px; color:#ffd9a0;
  text-shadow:0 0 6px rgba(255,190,110,.45);
}
.counter .engraved{ font-size:9px; }

/* شريط السجل */
#logbar{
  margin-top:14px; display:flex; gap:10px; align-items:center;
  padding:9px 13px; border-radius:8px; border:1px solid var(--edge);
  background:linear-gradient(180deg,#17181b,#101114);
  box-shadow:inset 0 2px 6px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.06);
  font-size:12px; color:#9aa0a8;
}
#logText{ flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.serial{ font-size:8.5px; }

/* مُنتقي النوافذ */
.modal{
  position:fixed; inset:0; z-index:60; display:flex; align-items:center; justify-content:center;
  background:rgba(8,9,11,.72); backdrop-filter:blur(4px);
  animation:fadein .18s ease-out;
}
@keyframes fadein{ from{ opacity:0; } }
.modal-box{ width:min(780px,92vw); max-height:82vh; overflow:auto; padding-bottom:16px; }
.modal-x{
  margin-left:auto; width:26px; height:26px; border-radius:6px; cursor:pointer;
  border:1px solid var(--groove); color:#c8ccd2; background:linear-gradient(180deg,#4a4e55,#2e3136);
  box-shadow:0 2px 0 var(--groove);
}
.modal-x:active{ transform:translateY(2px); box-shadow:none; }
#pickerGrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(172px,1fr)); gap:10px; }
.win-card{
  padding:8px; border-radius:8px; cursor:pointer; transition:.15s;
  background:linear-gradient(180deg,#2c2f34,#212428);
  border:1px solid #131417; box-shadow:0 3px 8px rgba(0,0,0,.4);
}
.win-card:hover{
  transform:translateY(-3px); border-color:rgba(255,176,58,.4);
  box-shadow:0 8px 18px rgba(0,0,0,.55), 0 0 0 1px rgba(255,176,58,.25);
}
.win-card img{
  width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:5px; display:block;
  background:#0a0b0c; filter:saturate(.85) contrast(1.05);
  box-shadow:inset 0 0 8px #000;
}
.win-card .nm{
  margin-top:7px; font-size:11px; color:#b9bec5; direction:ltr; text-align:left;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.loading{ grid-column:1/-1; text-align:center; padding:26px; color:#8b9097; }
::-webkit-scrollbar{ width:10px; height:10px; }
::-webkit-scrollbar-thumb{ background:linear-gradient(#4a4e55,#33363c); border-radius:6px; border:2px solid #14161a; }
::-webkit-scrollbar-track{ background:#14161a; }
</style>
</head>
<body>

<div id="device">
  <span class="screw" style="top:9px;left:9px;--rot:24deg"></span>
  <span class="screw" style="top:9px;right:9px;--rot:-52deg"></span>
  <span class="screw" style="bottom:9px;left:9px;--rot:80deg"></span>
  <span class="screw" style="bottom:9px;right:9px;--rot:-15deg"></span>

  <header id="titlebar">
    <div class="brand">
      <div class="badge">◉</div>
      <div class="brand-text">
        <h1>METALDECK <span>SR-79</span></h1>
        <p dir="rtl">مسجّل الشاشة المكتبي — معالجة محلية 100٪</p>
      </div>
    </div>
    <div class="tb-spec engraved">100% OFFLINE · LOCAL STORAGE ONLY</div>
    <div class="tb-led">
      <span class="led green on"></span><label class="engraved">PWR</label>
    </div>
    <div class="winbtns">
      <button id="btnMin" title="تصغير">–</button>
      <button id="btnMax" title="تكبير">□</button>
      <button id="btnClose" title="إغلاق">✕</button>
    </div>
  </header>

  <main id="deck">
    <section id="monitor-col">
      <div class="panel">
        <div class="panel-head">
          <span class="engraved">MONITOR</span>
          <span class="sub" dir="rtl">شاشة المعاينة</span>
          <span class="head-right"><span class="led red" id="ledRec"></span><label class="engraved">REC</label></span>
        </div>
        <div class="crt-wrap">
          <div class="crt" id="crt">
            <video id="preview" muted autoplay playsinline></video>
            <div class="static-layer" id="staticLayer"></div>
            <div class="rollbar"></div>
            <div class="osd">
              <span id="osdStatus" class="dim">NO SIGNAL</span>
              <span id="osdSrc"></span>
              <span id="osdClock"></span>
            </div>
            <div class="scanlines"></div>
            <div class="vignette"></div>
            <div class="snap-flash" id="snapFlash"></div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span class="engraved">TRANSPORT</span>
          <span class="sub" dir="rtl">أزرار التحكم</span>
        </div>
        <div class="transport">
          <button id="btnPause" class="key" title="إيقاف مؤقت / استئناف">
            <span class="key-top">❚❚<small>PAUSE</small></span>
          </button>
          <button id="btnStop" class="key disabled" title="إيقاف نهائي">
            <span class="key-top">■<small>STOP</small></span>
          </button>
          <div class="rec-wrap">
            <span class="rec-glow"></span>
            <button id="btnRec" title="بدء / إيقاف التسجيل"><span class="rec-core"></span></button>
            <span class="engraved">REC</span>
          </div>
          <button id="btnSnap" class="key" title="لقطة شاشة">
            <span class="key-top">✦<small>SNAP</small></span>
          </button>
          <div class="led-cluster">
            <div><span class="led red"   id="ledRec2"></span><label>REC</label></div>
            <div><span class="led amber" id="ledPause"></span><label>PAUSE</label></div>
            <div><span class="led green" id="ledReady"></span><label>READY</label></div>
          </div>
        </div>
      </div>
    </section>

    <section id="rack">
      <div class="panel">
        <div class="panel-head">
          <span class="engraved">ELAPSED</span>
          <span class="sub" dir="rtl">الزمن المنقضي</span>
        </div>
        <div class="seg-display">
          <span class="ghost">88:88:88</span>
          <span id="timer">00:00:00</span>
        </div>
        <div class="status-line" dir="rtl"><span id="statusText">جاهز للتسجيل</span></div>
        <div class="vu" id="vu"></div>
        <div class="vu-label engraved">AUDIO LEVEL ▸ VU</div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span class="engraved">SOURCE</span>
          <span class="sub" dir="rtl">مصدر الالتقاط</span>
        </div>
        <div class="switch-row">
          <button class="sw-opt engraved" id="optScreen">FULL SCREEN</button>
          <div class="track" id="modeTrack"><span class="lever"></span></div>
          <button class="sw-opt engraved" id="optWindow">WINDOW</button>
        </div>
        <button id="btnTune" class="key small wide disabled">
          <span class="key-top">TUNE ⌖<small dir="rtl">اختيار نافذة التطبيق</small></span>
        </button>
        <div class="mini-lcd" id="srcName">FULL SCREEN</div>
        <div class="switch-row tiny-row">
          <span class="engraved">FORMAT</span>
          <button class="sw-opt engraved" id="optWebm">WEBM</button>
          <div class="track tiny" id="fmtTrack"><span class="lever"></span></div>
          <button class="sw-opt engraved" id="optMp4">MP4</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span class="engraved">AUDIO SRC</span>
          <span class="sub" dir="rtl">مصدر الصوت — قابل للتبديل أثناء التسجيل</span>
        </div>
        <div class="knob-zone">
          <div class="knob" id="audioKnob" tabindex="0" role="button" title="قرص مصدر الصوت">
            <span class="cap" id="knobCap"><i class="pointer"></i></span>
          </div>
          <div class="a-labels" id="alabels">
            <button data-v="sys"><span class="led green"></span><b>SYS</b><small dir="rtl">صوت النظام فقط</small></button>
            <button data-v="mic"><span class="led green"></span><b>MIC</b><small dir="rtl">المايكروفون فقط</small></button>
            <button data-v="mix"><span class="led amber"></span><b>MIX</b><small dir="rtl">دمج المصدرين</small></button>
            <button data-v="mute"><span class="led red"></span><b>MUTE</b><small dir="rtl">بدون صوت</small></button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span class="engraved">HOTKEYS</span>
          <span class="sub" dir="rtl">اختصارات عامة — انقر ثم اضغط التركيب الجديد</span>
        </div>
        <ul class="hk-list" id="hotkeys"></ul>
      </div>

      <div class="panel">
        <div class="panel-head">
          <span class="engraved">FILES</span>
          <span class="sub" dir="rtl">التخزين المحلي</span>
        </div>
        <div class="mini-lcd path" id="dirLabel">…</div>
        <button id="btnFolder" class="key wide">
          <span class="key-top">⌂ OPEN FOLDER<small dir="rtl">فتح مجلد الحفظ</small></span>
        </button>
        <div class="counter"><span class="engraved">SESSION COUNT</span><span id="counter">000</span></div>
      </div>
    </section>
  </main>

  <footer id="logbar">
    <span class="led green tiny on" id="logLed"></span>
    <span id="logText" dir="rtl">جارٍ إقلاع النظام…</span>
    <span class="serial engraved">SN 0079-MD · MADE FOR WINDOWS</span>
  </footer>
</div>

<div id="picker" class="modal hidden">
  <div class="modal-box panel">
    <div class="panel-head">
      <span class="engraved">WINDOW TUNER</span>
      <span class="sub" dir="rtl">اختر نافذة التطبيق المراد تسجيلها</span>
      <button id="pickerClose" class="modal-x">✕</button>
    </div>
    <div id="pickerGrid"></div>
  </div>
</div>

<script>
'use strict';
/* ═══════════ MetalDeck SR-79 — منطق الجهاز (واجهة) ═══════════ */
var $ = function (s) { return document.querySelector(s); };
var els = {
  preview: $('#preview'), crt: $('#crt'), staticLayer: $('#staticLayer'),
  osdStatus: $('#osdStatus'), osdSrc: $('#osdSrc'), osdClock: $('#osdClock'),
  ledRec: $('#ledRec'), ledRec2: $('#ledRec2'), ledPause: $('#ledPause'), ledReady: $('#ledReady'),
  btnRec: $('#btnRec'), btnPause: $('#btnPause'), btnStop: $('#btnStop'), btnSnap: $('#btnSnap'),
  timer: $('#timer'), statusText: $('#statusText'), vu: $('#vu'),
  modeTrack: $('#modeTrack'), optScreen: $('#optScreen'), optWindow: $('#optWindow'),
  btnTune: $('#btnTune'), srcName: $('#srcName'),
  fmtTrack: $('#fmtTrack'), optWebm: $('#optWebm'), optMp4: $('#optMp4'),
  knobCap: $('#knobCap'), knob: $('#audioKnob'), alabels: $('#alabels'),
  hotkeys: $('#hotkeys'), dirLabel: $('#dirLabel'), btnFolder: $('#btnFolder'), counter: $('#counter'),
  logText: $('#logText'), picker: $('#picker'), pickerGrid: $('#pickerGrid'),
  pickerClose: $('#pickerClose'), snapFlash: $('#snapFlash'),
  btnMin: $('#btnMin'), btnMax: $('#btnMax'), btnClose: $('#btnClose')
};

var AUDIO_ORDER = ['sys', 'mic', 'mix', 'mute'];
var KNOB_ANGLES = { sys: -54, mic: -18, mix: 18, mute: 54 };
var AUDIO_TXT = {
  sys: 'SYS · صوت النظام فقط', mic: 'MIC · المايكروفون فقط',
  mix: 'MIX · دمج المصدرين',   mute: 'MUTE · بدون صوت'
};
var KEY_ACTIONS = [
  ['rec',   'بدء التسجيل'],
  ['stop',  'إيقاف نهائي'],
  ['pause', 'إيقاف مؤقت / استئناف'],
  ['snap',  'لقطة شاشة']
];
var DEFAULT_KEYS = { rec: 'Ctrl+Alt+R', stop: 'Ctrl+Alt+E', pause: 'Ctrl+Alt+P', snap: 'Ctrl+Alt+S' };

var state = {
  mode: localStorage.getItem('md.mode') || 'screen',
  windowSrc: null,
  audio: AUDIO_ORDER.indexOf(localStorage.getItem('md.audio')) >= 0 ? localStorage.getItem('md.audio') : 'sys',
  format: localStorage.getItem('md.format') === 'mp4' ? 'mp4' : 'webm',
  keys: Object.assign({}, DEFAULT_KEYS, JSON.parse(localStorage.getItem('md.keys') || '{}')),
  status: 'idle',
  stream: null, sysStream: null, micStream: null,
  audioCtx: null, recDest: null, gains: {}, analyser: null, analyserData: null,
  recorder: null, chunks: [], ext: 'webm',
  tStart: 0, tAccum: 0, timerId: null,
  session: 0
};

/* ─── أدوات عامة ─── */
function log(msg) { els.logText.textContent = msg; }
function fmtTime(ms) {
  var s = Math.floor(ms / 1000);
  function p(n) { return String(n).padStart(2, '0'); }
  return p(Math.floor(s / 3600)) + ':' + p(Math.floor(s / 60) % 60) + ':' + p(s % 60);
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* ─── أصوات الجهاز (مولّدة داخليًا) ─── */
var beepCtx = null;
function beep(freq, dur, vol, delay) {
  try {
    beepCtx = beepCtx || new AudioContext();
    var t = beepCtx.currentTime + (delay || 0);
    var o = beepCtx.createOscillator(), g = beepCtx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || .05, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + (dur || .09));
    o.connect(g); g.connect(beepCtx.destination);
    o.start(t); o.stop(t + (dur || .09) + .02);
  } catch (e) {}
}
function sfxStart() { beep(920, .07); beep(1380, .1, .05, .09); }
function sfxStop()  { beep(740, .09); beep(430, .16, .05, .1); }
function sfxSnap()  { beep(1800, .045, .07); beep(260, .05, .09, .02); }
function sfxTick()  { beep(1200, .035, .03); }

/* ─── تشويش الشاشة ─── */
(function makeStatic() {
  var c = document.createElement('canvas'); c.width = 180; c.height = 102;
  var x = c.getContext('2d'), img = x.createImageData(180, 102);
  for (var i = 0; i < img.data.length; i += 4) {
    var v = Math.random() * 255 | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 40;
  }
  x.putImageData(img, 0, 0);
  els.staticLayer.style.backgroundImage = 'url(' + c.toDataURL() + ')';
})();

setInterval(function () {
  els.osdClock.textContent = new Date().toLocaleTimeString('en-GB');
}, 1000);

/* ─── مؤشر VU ─── */
for (var _i = 0; _i < 14; _i++) els.vu.appendChild(document.createElement('i'));
function setVU(level) {
  var lit = Math.round(level * 14);
  var segs = els.vu.children;
  for (var i = 0; i < segs.length; i++) segs[i].classList.toggle('on', i < lit);
}
var vuRAF = 0;
function vuLoop() {
  if (!state.analyser) { setVU(0); vuRAF = 0; return; }
  state.analyser.getByteTimeDomainData(state.analyserData);
  var s = 0, d = state.analyserData;
  for (var i = 0; i < d.length; i++) { var x = (d[i] - 128) / 128; s += x * x; }
  setVU(Math.min(1, Math.sqrt(s / d.length) * 3));
  vuRAF = requestAnimationFrame(vuLoop);
}

/* ─── عرض الحالة ─── */
function setStatus(s) {
  state.status = s;
  var rec = s === 'recording', paused = s === 'paused', on = s !== 'idle';
  [els.ledRec, els.ledRec2].forEach(function (led) {
    led.classList.toggle('on', rec); led.classList.toggle('blink', rec);
  });
  els.ledPause.classList.toggle('on', paused);
  els.ledReady.classList.toggle('on', !on);
  els.btnRec.classList.toggle('armed', on);
  els.btnPause.classList.toggle('pressed', paused);
  els.btnStop.classList.toggle('disabled', !on);
  els.crt.classList.toggle('live', on);
  els.timer.classList.toggle('blink', paused);
  els.statusText.textContent = rec ? '● جارٍ التسجيل الآن' : paused ? 'إيقاف مؤقت' : 'جاهز للتسجيل';
  els.osdStatus.textContent = rec ? '● REC' : paused ? '❚❚ PAUSE' : 'NO SIGNAL';
  els.osdStatus.className = rec ? 'red' : paused ? 'amber' : 'dim';
  els.osdSrc.textContent = on
    ? (state.mode === 'window' ? (state.windowSrc ? state.windowSrc.name : 'WINDOW') : 'FULL SCREEN') + ' · ' + state.audio.toUpperCase()
    : '';
}
function renderTimer() {
  var ms = state.status === 'paused' ? state.tAccum : state.tAccum + performance.now() - state.tStart;
  els.timer.textContent = fmtTime(ms);
}
function renderCounter() { els.counter.textContent = String(state.session).padStart(3, '0'); }

function renderMode() {
  var win = state.mode === 'window';
  els.modeTrack.classList.toggle('right', win);
  els.optScreen.classList.toggle('active', !win);
  els.optWindow.classList.toggle('active', win);
  els.btnTune.classList.toggle('disabled', !win);
  els.srcName.textContent = win
    ? (state.windowSrc ? state.windowSrc.name : '— SELECT WINDOW —')
    : 'FULL SCREEN · الشاشة كاملة';
}
function renderAudio() {
  els.knobCap.style.setProperty('--rot', KNOB_ANGLES[state.audio] + 'deg');
  els.alabels.querySelectorAll('button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.v === state.audio);
  });
}
function renderFormat() {
  els.fmtTrack.classList.toggle('right', state.format === 'mp4');
  els.optWebm.classList.toggle('active', state.format === 'webm');
  els.optMp4.classList.toggle('active', state.format === 'mp4');
}
function renderKeys() {
  els.hotkeys.innerHTML = '';
  KEY_ACTIONS.forEach(function (row) {
    var a = row[0], label = row[1];
    var li = document.createElement('li');
    var nm = document.createElement('span'); nm.className = 'hk-name'; nm.textContent = label;
    var btn = document.createElement('button');
    btn.className = 'combo'; btn.textContent = state.keys[a] || '—';
    btn.title = 'انقر ثم اضغط تركيب المفاتيح الجديد';
    btn.onclick = function () { listenKey(btn, a); };
    li.appendChild(nm); li.appendChild(btn); els.hotkeys.appendChild(li);
  });
}

/* ═══ محرك الصوت (ميكسر داخلي — تبديل حي أثناء التسجيل) ═══ */
var SYS_AUDIO = { mandatory: { chromeMediaSource: 'desktop' } };
function videoConstraint(id) {
  return { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id } };
}
async function ensureAudioSrc(kind) {
  if (kind === 'sys' && !state.sysStream)
    state.sysStream = await navigator.mediaDevices.getUserMedia({ audio: SYS_AUDIO, video: false });
  if (kind === 'mic' && !state.micStream)
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
    });
}
function connectSource(kind) {
  var stream = kind === 'sys' ? state.sysStream : state.micStream;
  if (!stream || !state.audioCtx || state.gains[kind]) return;
  var g = state.audioCtx.createGain();
  state.audioCtx.createMediaStreamSource(stream).connect(g);
  g.connect(state.recDest);
  state.gains[kind] = g;
}
function applyGains() {
  var on = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  ['sys', 'mic'].forEach(function (k) {
    if (state.gains[k]) state.gains[k].gain.value = on[k] ? 1 : 0;
  });
}
async function openAudioGraph() {
  var ctx = new AudioContext();
  await ctx.resume().catch(function () {});
  state.audioCtx = ctx;
  state.recDest = ctx.createMediaStreamDestination();
  var need = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  for (var kind of ['sys', 'mic']) {
    if (!need[kind]) continue;
    try { await ensureAudioSrc(kind); connectSource(kind); }
    catch (e) {
      log(kind === 'mic' ? '⚠ تعذّر فتح المايكروفون — تحقق من أذونات النظام' : '⚠ تعذّر التقاط صوت النظام');
    }
  }
  applyGains();
  state.analyser = ctx.createAnalyser();
  state.analyser.fftSize = 1024;
  state.analyserData = new Uint8Array(state.analyser.fftSize);
  ctx.createMediaStreamSource(state.recDest.stream).connect(state.analyser);
  return state.recDest.stream;
}
async function switchAudioLive() {
  var need = {
    sys: state.audio === 'sys' || state.audio === 'mix',
    mic: state.audio === 'mic' || state.audio === 'mix'
  };
  for (var k of ['sys', 'mic']) {
    if (need[k] && !state.gains[k]) {
      try { await ensureAudioSrc(k); connectSource(k); }
      catch (e) { log('⚠ تعذّر فتح مصدر الصوت'); }
    }
  }
  applyGains();
}
async function setAudio(v) {
  state.audio = v;
  localStorage.setItem('md.audio', v);
  renderAudio(); sfxTick();
  if (state.status !== 'idle') await switchAudioLive();
  log('مصدر الصوت: ' + AUDIO_TXT[v]);
}

/* ═══ التسجيل ═══ */
async function currentSource() {
  if (state.mode === 'screen') {
    var s = await window.deck.getSources(['screen']);
    if (!s.length) throw new Error('لم يتم العثور على شاشة');
    return s[0];
  }
  if (!state.windowSrc) throw new Error('اختر نافذة أولاً من زر TUNE');
  return state.windowSrc;
}
function pickMime() {
  var list = state.format === 'mp4'
    ? ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (var i = 0; i < list.length; i++)
    if (window.MediaRecorder.isTypeSupported(list[i])) return list[i];
  return '';
}

async function startRecording() {
  if (state.status !== 'idle') return;
  try {
    var src = await currentSource();
    var vs = await navigator.mediaDevices.getUserMedia({ video: videoConstraint(src.id), audio: false });

    var audioStream = null;
    try { audioStream = await openAudioGraph(); }
    catch (e) { log('⚠ الصوت غير متاح — تسجيل صامت'); }

    state.stream = new MediaStream([].concat(
      vs.getVideoTracks(),
      audioStream ? audioStream.getAudioTracks() : []
    ));

    var mime = pickMime();
    state.recorder = new MediaRecorder(state.stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : undefined);
    state.ext = (state.recorder.mimeType || mime || '').indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    state.chunks = [];
    state.recorder.ondataavailable = function (e) { if (e.data && e.data.size) state.chunks.push(e.data); };
    state.recorder.onerror = function () { log('⚠ خطأ أثناء التسجيل'); };
    state.recorder.onstop = function () { finalizeRecording(); };
    state.recorder.start(1000);

    els.preview.srcObject = state.stream;
    state.tStart = performance.now(); state.tAccum = 0;
    state.timerId = setInterval(renderTimer, 200);
    setStatus('recording');
    vuLoop(); sfxStart();
    log('● بدأ التسجيل — ' + AUDIO_TXT[state.audio]);
  } catch (err) {
    cleanup(); setStatus('idle');
    log('⚠ تعذّر بدء التسجيل: ' + (err.message || err));
  }
}

function stopRecording() {
  if (state.status === 'idle') return;
  if (state.status === 'recording') state.tAccum += performance.now() - state.tStart;
  els.preview.srcObject = null;
  try { state.recorder.stop(); } catch (e) {}
  setStatus('idle'); sfxStop();
  log('■ إيقاف — جارٍ الحفظ…');
}

async function finalizeRecording() {
  clearInterval(state.timerId); state.timerId = null;
  var blob = new Blob(state.chunks, { type: (state.recorder && state.recorder.mimeType) || 'video/webm' });
  state.chunks = [];
  if (blob.size > 400) {
    try {
      var buf = new Uint8Array(await blob.arrayBuffer());
      var file = await window.deck.saveVideo(buf, state.ext);
      state.session++; renderCounter();
      log('✓ تم حفظ الفيديو: ' + file);
    } catch (e) { log('⚠ فشل حفظ الملف: ' + e); }
  } else log('⚠ لا توجد بيانات كافية للحفظ');
  cleanup();
}

function togglePause() {
  if (state.status === 'recording') {
    state.recorder.pause();
    state.tAccum += performance.now() - state.tStart;
    setStatus('paused'); beep(500, .08);
    log('❚❚ إيقاف مؤقت');
  } else if (state.status === 'paused') {
    state.recorder.resume();
    state.tStart = performance.now();
    setStatus('recording'); beep(900, .08);
    log('● استئناف التسجيل');
  }
}

function cleanup() {
  cancelAnimationFrame(vuRAF); vuRAF = 0; setVU(0);
  [state.stream, state.sysStream, state.micStream].forEach(function (s) {
    if (s) s.getTracks().forEach(function (t) { t.stop(); });
  });
  try { if (state.audioCtx) state.audioCtx.close(); } catch (e) {}
  state.stream = null; state.sysStream = null; state.micStream = null;
  state.audioCtx = null; state.recDest = null; state.gains = {};
  state.analyser = null; state.recorder = null;
  els.preview.srcObject = null;
}

/* ─── التقاط الصور ─── */
async function snap() {
  try {
    var v = null, temp = null;
    if (state.status !== 'idle' && els.preview.srcObject) {
      v = els.preview;
    } else {
      var src = await currentSource();
      temp = await navigator.mediaDevices.getUserMedia({ video: videoConstraint(src.id), audio: false });
      v = document.createElement('video');
      v.muted = true; v.srcObject = temp;
      await v.play();
      await new Promise(function (r) { setTimeout(r, 420); });
    }
    if (!v.videoWidth) throw new Error('لا يوجد إطار للالتقاط');
    var c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    var b = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    var file = await window.deck.saveImage(new Uint8Array(await b.arrayBuffer()), 'png');
    state.session++; renderCounter();
    flash(); sfxSnap();
    log('✓ لقطة محفوظة: ' + file);
    if (temp) temp.getTracks().forEach(function (t) { t.stop(); });
  } catch (e) { log('⚠ تعذّر الالتقاط: ' + e.message); }
}
function flash() {
  els.snapFlash.classList.remove('go'); void els.snapFlash.offsetWidth;
  els.snapFlash.classList.add('go');
}

/* ─── المصدر / الصيغة ─── */
function setMode(m) {
  if (state.status !== 'idle') return log('⚠ أوقف التسجيل قبل تغيير المصدر');
  state.mode = m; localStorage.setItem('md.mode', m);
  if (m === 'screen') state.windowSrc = null;
  renderMode(); sfxTick();
}
function setFormat(f) {
  if (state.status !== 'idle') return log('⚠ أوقف التسجيل قبل تغيير الصيغة');
  state.format = f; localStorage.setItem('md.format', f);
  renderFormat(); sfxTick();
}

/* ─── مُنتقي النوافذ ─── */
async function openPicker() {
  els.picker.classList.remove('hidden');
  els.pickerGrid.innerHTML = '<p class="loading">جارٍ مسح النوافذ المفتوحة…</p>';
  try {
    var srcs = await window.deck.getSources(['window']);
    srcs = srcs.filter(function (s) { return s.name && s.name.trim(); });
    if (!srcs.length) {
      els.pickerGrid.innerHTML = '<p class="loading">لا توجد نوافذ مفتوحة</p>'; return;
    }
    els.pickerGrid.innerHTML = '';
    srcs.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'win-card';
      card.innerHTML = '<img src="' + s.thumb + '" alt=""><div class="nm">' + escapeHtml(s.name) + '</div>';
      card.onclick = function () {
        state.windowSrc = { id: s.id, name: s.name };
        setMode('window');
        els.picker.classList.add('hidden');
        log('تم ضبط المصدر على نافذة: ' + s.name);
      };
      els.pickerGrid.appendChild(card);
    });
  } catch (e) {
    els.pickerGrid.innerHTML = '<p class="loading">⚠ خطأ في جلب النوافذ</p>';
  }
}

/* ─── الاختصارات العالمية ─── */
function keyToAccel(e) {
  if (['Control', 'Alt', 'Shift', 'Meta'].indexOf(e.key) >= 0) return null;
  var parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (!parts.length) return null;
  var k = e.key;
  if (k === ' ') k = 'Space'; else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join('+');
}
function listenKey(btn, action) {
  document.querySelectorAll('.combo.listening').forEach(function (b) { b.classList.remove('listening'); });
  btn.classList.add('listening'); btn.textContent = 'اضغط الاختصار…';
  var h = function (e) {
    e.preventDefault(); e.stopPropagation();
    var acc = keyToAccel(e);
    if (!acc) return;
    window.removeEventListener('keydown', h, true);
    btn.classList.remove('listening');
    state.keys[action] = acc;
    localStorage.setItem('md.keys', JSON.stringify(state.keys));
    btn.textContent = acc;
    registerKeys(); sfxTick();
  };
  window.addEventListener('keydown', h, true);
  setTimeout(function () {
    window.removeEventListener('keydown', h, true);
    if (btn.classList.contains('listening')) {
      btn.classList.remove('listening'); btn.textContent = state.keys[action];
    }
  }, 12000);
}
async function registerKeys() {
  try {
    var res = await window.deck.registerShortcuts(state.keys);
    for (var a in res)
      if (!res[a]) log('⚠ تعذّر تسجيل الاختصار: ' + state.keys[a]);
  } catch (e) {}
}
window.deck.onShortcut(function (a) {
  if (a === 'rec')   state.status === 'idle' ? startRecording() : stopRecording();
  else if (a === 'stop')  stopRecording();
  else if (a === 'pause') togglePause();
  else if (a === 'snap')  snap();
});

/* الموثوقية: احفظ الجزء المسجّل عند إغلاق التطبيق أثناء التسجيل */
window.deck.onPrepareQuit(async function () {
  if (state.status === 'idle' || !state.recorder) return window.deck.quitDone();
  try {
    state.recorder.onstop = async function () {
      try {
        var blob = new Blob(state.chunks, { type: (state.recorder && state.recorder.mimeType) || 'video/webm' });
        if (blob.size > 400)
          window.deck.saveVideoSync(new Uint8Array(await blob.arrayBuffer()), state.ext);
      } catch (e) {}
      window.deck.quitDone();
    };
    state.recorder.stop();
  } catch (e) { window.deck.quitDone(); }
});

/* ─── ربط الواجهة ─── */
els.btnRec.onclick   = function () { state.status === 'idle' ? startRecording() : stopRecording(); };
els.btnStop.onclick  = function () { stopRecording(); };
els.btnPause.onclick = function () { togglePause(); };
els.btnSnap.onclick  = function () { snap(); };
els.btnTune.onclick  = function () { openPicker(); };
els.pickerClose.onclick = function () { els.picker.classList.add('hidden'); };
els.btnFolder.onclick = function () { window.deck.openFolder(); };

els.optScreen.onclick = function () { setMode('screen'); };
els.optWindow.onclick = function () { setMode('window'); if (!state.windowSrc) openPicker(); };
els.modeTrack.onclick = function () { state.mode === 'screen' ? els.optWindow.onclick() : setMode('screen'); };

els.optWebm.onclick = function () { setFormat('webm'); };
els.optMp4.onclick  = function () { setFormat('mp4'); };
els.fmtTrack.onclick = function () { setFormat(state.format === 'webm' ? 'mp4' : 'webm'); };

els.alabels.querySelectorAll('button').forEach(function (b) {
  b.onclick = function () { setAudio(b.dataset.v); };
});
els.knob.onclick = function () {
  setAudio(AUDIO_ORDER[(AUDIO_ORDER.indexOf(state.audio) + 1) % 4]);
};
els.knob.onkeydown = function (e) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.knob.onclick(); }
};

els.btnMin.onclick   = function () { window.deck.winControl('min'); };
els.btnMax.onclick   = function () { window.deck.winControl('max'); };
els.btnClose.onclick = function () { window.deck.winControl('close'); };

/* ─── الإقلاع ─── */
renderMode(); renderAudio(); renderFormat(); renderKeys(); renderCounter();
setStatus('idle'); registerKeys();
window.deck.getSaveDir().then(function (d) { els.dirLabel.textContent = d; }).catch(function () {});
log('النظام جاهز — كل المعالجة والتخزين يتمان محليًا');
</script>
</body>
</html>`;

  /* ─── النافذة ─── */
  function createWindow() {
    /* تُكتب الواجهة إلى مجلد التطبيق ثم تُحمَّل محليًا (امتداد للملف الواحد) */
    const htmlPath = path.join(app.getPath('userData'), 'metaldeck-ui.html');
    fs.writeFileSync(htmlPath, HTML);

    win = new BrowserWindow({
      width: 1100,
      height: 780,
      minWidth: 960,
      minHeight: 660,
      frame: false,
      backgroundColor: '#141518',
      show: false,
      webPreferences: {
        preload: __filename,          /* نفس هذا الملف يعمل كـ Preload */
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });

    Menu.setApplicationMenu(null);
    win.loadFile(htmlPath);
    win.once('ready-to-show', () => win.show());

    /* إغلاق آمن: احفظ التسجيل الجاري قبل الخروج */
    win.on('close', (e) => {
      if (!allowClose) {
        e.preventDefault();
        win.webContents.send('prepare-quit');
        setTimeout(() => { allowClose = true; if (win) win.destroy(); }, 4000);
      }
    });
  }

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) =>
      cb(permission === 'media' || permission === 'mediaKeySystem'));
    session.defaultSession.setPermissionCheckHandler(
      (_s, p) => p === 'media' || p === 'mediaKeySystem');

    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  /* أمان: منع أي تنقّل أو نوافذ خارجية — تطبيق أوفلاين */
  app.on('web-contents-created', (_e, wc) => {
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', e => e.preventDefault());
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => globalShortcut.unregisterAll());

  /* ─── قنوات IPC ─── */
  ipcMain.handle('get-sources', async (_e, types) => {
    const srcs = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 360, height: 203 },
      fetchWindowIcons: true
    });
    return srcs.map(s => ({
      id: s.id,
      name: s.name || '—',
      thumb: s.thumbnail.toDataURL(),
      icon: s.appIcon ? s.appIcon.toDataURL() : null
    }));
  });

  ipcMain.handle('save-video', (_e, data, ext) => writeFile('videos', 'REC', ext, data));
  ipcMain.on('save-video-sync', (e, data, ext) => {
    try { e.returnValue = writeFile('videos', 'REC', ext, data); }
    catch { e.returnValue = null; }
  });
  ipcMain.handle('save-image', (_e, data, ext) => writeFile('shots', 'SNAP', ext, data));

  ipcMain.handle('open-folder', async () => {
    const dir = saveDir();
    await shell.openPath(dir);
    return dir;
  });
  ipcMain.handle('get-save-dir', () => saveDir());

  ipcMain.handle('register-shortcuts', (_e, map) => {
    globalShortcut.unregisterAll();
    const ok = {};
    for (const [action, accel] of Object.entries(map || {})) {
      try {
        ok[action] = globalShortcut.register(accel,
          () => { if (win) win.webContents.send('shortcut', action); });
      } catch { ok[action] = false; }
    }
    return ok;
  });

  ipcMain.on('win-control', (_e, cmd) => {
    if (!win) return;
    if (cmd === 'min') win.minimize();
    else if (cmd === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (cmd === 'close') win.close();
  });

  ipcMain.on('quit-done', () => { allowClose = true; if (win) win.destroy(); });

/* ════════════════════════════════════════════════════════════════════
   ② برنامج التحميل المسبق (Preload) — يُحمَّل من نفس الملف
   ════════════════════════════════════════════════════════════════════ */
} else if (isPreload) {

  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('deck', {
    getSources:        (types)    => ipcRenderer.invoke('get-sources', types),
    saveVideo:         (buf, ext) => ipcRenderer.invoke('save-video', buf, ext),
    saveVideoSync:     (buf, ext) => ipcRenderer.sendSync('save-video-sync', buf, ext),
    saveImage:         (buf, ext) => ipcRenderer.invoke('save-image', buf, ext),
    openFolder:        ()         => ipcRenderer.invoke('open-folder'),
    getSaveDir:        ()         => ipcRenderer.invoke('get-save-dir'),
    registerShortcuts: (map)      => ipcRenderer.invoke('register-shortcuts', map),
    winControl:        (cmd)      => ipcRenderer.send('win-control', cmd),
    quitDone:          ()         => ipcRenderer.send('quit-done'),
    onShortcut:        (cb)       => ipcRenderer.on('shortcut', (_e, a) => cb(a)),
    onPrepareQuit:     (cb)       => ipcRenderer.on('prepare-quit', () => cb())
  });
}