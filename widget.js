/* Уведомления для OBS (widget.html) */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);

  var SOUND = params.get("sound") !== "0" && (typeof SETTINGS === "undefined" || SETTINGS.sound !== false);
  var VOL = parseFloat(params.get("vol"));
  if (isNaN(VOL)) VOL = (typeof SETTINGS !== "undefined" && SETTINGS.volume) || 0.6;
  var DUR = parseFloat(params.get("dur"));
  if (isNaN(DUR)) {
    DUR = (typeof SETTINGS !== "undefined" && typeof SETTINGS.duration === "number") ? SETTINGS.duration : 14;
  }
  var MAXQ = (typeof SETTINGS !== "undefined" && SETTINGS.maxOnScreen) || 5;

  var wrap = document.getElementById("wrap");

  /* ---------- звук (WebAudio, без файлов) ---------- */
  var actx = null;
  function chime() {
    if (!SOUND) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!actx) actx = new Ctx();
      if (actx.state === "suspended") actx.resume();
      var t = actx.currentTime;
      var notes = [[880, 0], [1174.66, 0.16]]; /* A5 -> D6, «динь-дон» */
      for (var i = 0; i < notes.length; i++) {
        var o = actx.createOscillator();
        var g = actx.createGain();
        o.type = "sine";
        o.frequency.value = notes[i][0];
        g.gain.setValueAtTime(0.0001, t + notes[i][1]);
        g.gain.exponentialRampToValueAtTime(Math.max(VOL, 0.001), t + notes[i][1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + notes[i][1] + 0.9);
        o.connect(g);
        g.connect(actx.destination);
        o.start(t + notes[i][1]);
        o.stop(t + notes[i][1] + 1);
      }
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
      card.classList.add("out");
      window.setTimeout(function () {
        if (card.parentNode) card.parentNode.removeChild(card);
      }, 500);
    }

    var card = buildCard(data, closeCard);
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
    warn.textContent = "⚠️ Не настроен config.js — открой README.md и сделай шаги 1–2.";
    wrap.appendChild(warn);
    return;
  }

  var ref = db.ref("submissions");
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
    w.textContent = "⚠️ Нет доступа к базе: " + ((err && err.message) || "ошибка") + ". Проверь правила Firebase (README, Шаг 6).";
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
})();

