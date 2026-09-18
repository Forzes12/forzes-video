/* Уведомления для OBS (widget.html) */
(function () {
  "use strict";

  /* Виджет открывается только по ссылке с ключом (?key=... — её генерирует
     settings.html для OBS) или после ввода пароля. */
  if (window.studioGate && window.studioGate.requireKey) {
    window.studioGate.requireKey(start);
    return;
  }
  start();

  function start() {

  var params = new URLSearchParams(location.search);

  var SOUND = params.get("sound") !== "0" && (typeof SETTINGS === "undefined" || SETTINGS.sound !== false);
  var VOL = parseFloat(params.get("vol"));
  if (isNaN(VOL)) VOL = (typeof SETTINGS !== "undefined" && SETTINGS.volume) || 0.6;
  var DUR = parseFloat(params.get("dur"));
  if (isNaN(DUR)) {
    DUR = (typeof SETTINGS !== "undefined" && typeof SETTINGS.duration === "number") ? SETTINGS.duration : 14;
  }
  var MAXQ = (typeof SETTINGS !== "undefined" && SETTINGS.maxOnScreen) || 5;
  var SCALE = parseFloat(params.get("scale"));
  if (isNaN(SCALE) || SCALE < 0.4 || SCALE > 3) SCALE = 1;
  var ANIM_IN = params.get("ain") || "slide-right";
  var ANIM_OUT = params.get("aout") || "slide-right";
  var SPD = parseFloat(params.get("spd"));
  if (isNaN(SPD) || SPD < 0.1 || SPD > 3) SPD = 0.45;

  var wrap = document.getElementById("wrap");

  /* ---------- анимация: keyframes генерируются под настройки ---------- */
  function kfIn(type, s) {
    var sc = s === 1 ? "" : " scale(" + s + ")";
    var end = s === 1 ? "transform:none" : "transform:scale(" + s + ")";
    if (type === "slide-top") return "@keyframes wIn{from{transform:translateY(-130%)" + sc + ";opacity:0}to{" + end + ";opacity:1}}";
    if (type === "slide-bottom") return "@keyframes wIn{from{transform:translateY(130%)" + sc + ";opacity:0}to{" + end + ";opacity:1}}";
    if (type === "zoom") return "@keyframes wIn{from{transform:scale(" + (s * 0.5) + ");opacity:0}to{" + end + ";opacity:1}}";
    if (type === "fade") return "@keyframes wIn{from{opacity:0}to{opacity:1}}";
    return "@keyframes wIn{from{transform:translateX(130%)" + sc + ";opacity:0}to{" + end + ";opacity:1}}";
  }
  function kfOut(type, s) {
    var sc = s === 1 ? "" : " scale(" + s + ")";
    if (type === "zoom") return "@keyframes wOut{to{transform:scale(" + (s * 0.5) + ");opacity:0}}";
    if (type === "fade") return "@keyframes wOut{to{opacity:0}}";
    return "@keyframes wOut{to{transform:translateX(130%)" + sc + "}}";
  }
  (function () {
    var st = document.createElement("style");
    st.textContent = kfIn(ANIM_IN, SCALE) + kfOut(ANIM_OUT, SCALE);
    document.head.appendChild(st);
  })();

  /* ---------- звук: свой mp3 из базы, иначе стандартный «блип» ---------- */
  var actx = null;
  var customBuf = null; /* AudioBuffer своего звука (mp3 из настроек) */

  function ensureCtx() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!actx) actx = new Ctx();
    if (actx.state === "suspended") { try { actx.resume(); } catch (e) {} }
    return actx;
  }

  function b64ToArrayBuffer(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  /* rec = { b64, mime, name } из базы (узел widgetSound) */
  function applyCustomSound(rec) {
    customBuf = null;
    if (!SOUND || !rec || typeof rec.b64 !== "string" || !rec.b64) return;
    var ctx = ensureCtx();
    if (!ctx) return;
    try {
      ctx.decodeAudioData(b64ToArrayBuffer(rec.b64)).then(function (buf) {
        customBuf = buf;
      })["catch"](function () {
        customBuf = null; /* файл не декодировался — играет стандартный звук */
      });
    } catch (e) { customBuf = null; }
  }

  function chime() {
    if (!SOUND) return;
    var ctx = ensureCtx();
    if (!ctx) return;

    /* свой mp3 — приоритет */
    if (customBuf) {
      try {
        var src = ctx.createBufferSource();
        var cg = ctx.createGain();
        src.buffer = customBuf;
        cg.gain.value = Math.min(Math.max(VOL, 0), 1);
        src.connect(cg); cg.connect(ctx.destination);
        src.start(0);
        return;
      } catch (e) { /* падаем на стандартный блип */ }
    }

    try {
      var t = ctx.currentTime;
      /* одна мягкая нота с тёплым тембром (треугольник) и плавным затуханием */
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      var f = ctx.createBiquadFilter(); /* срез верхов — убирает резкость */
      f.type = "lowpass";
      f.frequency.value = 1800;
      o.type = "triangle";
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
      var v = Math.max(VOL, 0.001) * 0.5; /* доп. смягчение громкости */
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(f); f.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.6);
    } catch (e) { console.warn("Не удалось воспроизвести звук:", e); }
  }

  /* ---------- разбор ссылки YouTube ---------- */
  function extractYouTubeId(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    var host = u.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    if (host === "youtu.be") {
      var p = u.pathname.split("/").filter(Boolean);
      if (p[0] && /^[A-Za-z0-9_-]{11}$/.test(p[0])) return p[0];
      return null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      var v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      var parts = u.pathname.split("/").filter(Boolean);
      for (var i = 0; i < parts.length - 1; i++) {
        if (parts[i] === "shorts" || parts[i] === "embed" || parts[i] === "live" || parts[i] === "v") {
          if (parts[i + 1] && /^[A-Za-z0-9_-]{11}$/.test(parts[i + 1])) return parts[i + 1];
        }
      }
    }
    return null;
  }
  /* ---------- карточка уведомления ---------- */
  function buildCard(data, closeCard) {
    var card = document.createElement("div");
    card.className = "card";

    var head = document.createElement("div");
    head.className = "head";
    var dot = document.createElement("span");
    dot.className = "dot";
    var title = document.createElement("span");
    title.textContent = "🎥 Новое видео на обзор";
    head.appendChild(dot);
    head.appendChild(title);
    card.appendChild(head);

    /* кнопка «скип» — убрать карточку */
    var close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.title = "Скип — убрать карточку";
    close.setAttribute("aria-label", "Скип");
    close.textContent = "✕";
    close.addEventListener("click", function (ev) {
      ev.preventDefault();
      closeCard();
    });
    card.appendChild(close);

    var img = document.createElement("img");
    img.className = "thumb";
    img.alt = "";
    img.src = "https://i.ytimg.com/vi/" + data.vid + "/mqdefault.jpg";
    card.appendChild(img);

    var nick = document.createElement("div");
    nick.className = "nick";
    var who = document.createElement("span");
    who.className = "who";
    who.textContent = data.nick || "Зритель";
    nick.appendChild(document.createTextNode("От: "));
    nick.appendChild(who);
    card.appendChild(nick);

    if (data.message) {
      var m = document.createElement("div");
      m.className = "msg";
      m.textContent = data.message;
      card.appendChild(m);
    }

    var row = document.createElement("div");
    row.className = "row";
    var open = document.createElement("a");
    open.className = "btn";
    open.href = data.link || ("https://youtu.be/" + data.vid);
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "▶ Смотреть видео";
    open.addEventListener("click", function () {
      window.setTimeout(closeCard, 400);
    });
    row.appendChild(open);
    card.appendChild(row);

    return card;
  }

  function showNotification(data) {
    while (wrap.children.length >= MAXQ && wrap.firstChild) {
      wrap.removeChild(wrap.firstChild);
    }

    function closeCard() {
      if (card._closed) return;
      card._closed = true;
      card.style.animation = "wOut " + SPD + "s ease forwards";
      window.setTimeout(function () {
        if (card.parentNode) card.parentNode.removeChild(card);
      }, SPD * 1000 + 60);
    }

    var card = buildCard(data, closeCard);
    if (SCALE !== 1) {
      card.style.transformOrigin = "top right";
      card.style.transform = "scale(" + SCALE + ")";
    }
    card.style.animation = "wIn " + SPD + "s cubic-bezier(.18,.9,.28,1.15) both";
    wrap.appendChild(card);
    chime();

    /* DUR = 0 — карточка висит, пока её не скипнут; DUR > 0 — авто-скрытие */
    if (DUR > 0) {
      window.setTimeout(closeCard, DUR * 1000);
    }
  }

  /* ---------- тестовое уведомление (?test=1) ---------- */
  if (params.get("test") === "1") {
    window.setTimeout(function () {
      showNotification({
        nick: "ТЕСТ",
        message: "Это тестовое уведомление. Видишь карточку и слышишь звук — значит всё работает! 🎉",
        vid: "dQw4w9WgXcQ",
        link: "https://youtu.be/dQw4w9WgXcQ"
      });
    }, 800);
  }

  /* ---------- подключение к базе ---------- */
  var db = initDatabase();
  if (!db) {
    var warn = document.createElement("div");
    warn.className = "card";
    warn.textContent = "⚠️ Не настроен config.js — стримеру нужно вставить конфиг Firebase.";
    wrap.appendChild(warn);
    return;
  }

  var ref = db.ref("submissions");

  /* свой звук: слушаем узел widgetSound — замена подхватывается на лету */
  db.ref("widgetSound").on("value", function (snap) {
    applyCustomSound(snap.val());
  }, function () { /* нет прав на узел — тихо играем стандартный звук */ });

  var buffer = [];
  var baseline = null;
  var ready = false;

  function handle(snap) {
    var d = snap.val();
    if (!d) return;
    var vid = d.vid || extractYouTubeId(d.link) || "dQw4w9WgXcQ";
    showNotification({
      nick: d.nick || "Зритель",
      message: d.message || "",
      link: d.link || ("https://youtu.be/" + vid),
      vid: vid
    });
  }

  ref.on("child_added", function (snap) {
    if (!ready) { buffer.push(snap); return; }
    if (baseline === null || snap.key > baseline) handle(snap);
  }, function (err) {
    var w = document.createElement("div");
    w.className = "card";
    w.textContent = "⚠️ Нет доступа к базе: " + ((err && err.message) || "ошибка") + ". Проверь правила доступа в Firebase (Realtime Database → Rules).";
    wrap.appendChild(w);
  });

  ref.limitToLast(1).once("value").then(function (snap) {
    snap.forEach(function (ch) { baseline = ch.key; });
    ready = true;
    for (var i = 0; i < buffer.length; i++) {
      if (baseline === null || buffer[i].key > baseline) handle(buffer[i]);
    }
    buffer.length = 0;
  }).catch(function (err) {
    ready = true;
    console.error(err);
  });

  }
})();

