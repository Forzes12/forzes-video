/* Логика формы отправки (index.html) */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  var form = $("form");
  var nick = $("nick");
  var link = $("link");
  var msg = $("msg");
  var hp = $("hp");
  var btn = $("btn");
  var statusBox = $("status");
  var preview = $("preview");
  var thumb = $("thumb");
  var pvText = $("pvText");
  var success = $("success");
  var again = $("again");
  var counter = $("cnt");
  var msgMax = $("msgMax");
  var setupWarn = $("setupWarn");

  var idBadge = $("idBadge");
  var idLock = $("idLock");
  var idHint = $("idHint");
  var twitchBtn = $("twitchBtn");
  var switchAcc = $("switchAcc");

  var identity = window.identity || null;
  /* false — ник берётся только из подтверждённого аккаунта,
     в поле писать нельзя и в базу уходит именно подтверждённое значение */
  var MANUAL = !!(typeof SETTINGS !== "undefined" && SETTINGS.allowManualNick);

  function currentIdentity() { return identity ? identity.current() : null; }

  function platformLabel(p) {
    if (p === "twitch") return "Twitch";
    if (p === "youtube") return "YouTube";
    if (p === "vk") return "VK";
    if (p === "telegram") return "Telegram";
    return p ? String(p).charAt(0).toUpperCase() + String(p).slice(1) : "";
  }

  /* с какой платформы человек перешёл: параметр ссылки (?src=twitch)
     или источник перехода (document.referrer) */
  function sourcePlatform() {
    var p = "";
    try {
      var q = new URLSearchParams(location.search);
      p = q.get("src") || q.get("from") || q.get("platform") || "";
    } catch (e) {}

    if (!p && document.referrer) {
      try {
        var h = new URL(document.referrer).hostname.replace(/^www\./i, "").toLowerCase();
        if (h === "twitch.tv" || /\.twitch\.tv$/.test(h)) p = "twitch";
        else if (h === "youtu.be" || /\.youtube\.com$/.test(h)) p = "youtube";
        else if (h === "vk.com" || h === "vk.ru") p = "vk";
        else if (h === "t.me" || h === "telegram.me") p = "telegram";
      } catch (e) {}
    }

    p = String(p || "").toLowerCase().trim();
    if (p === "twitch" || p === "youtube" || p === "vk" || p === "telegram") return p;
    return "";
  }

  /* ---------- состояние поля ника ---------- */
  function renderIdentity() {
    var who = currentIdentity();

    if (who) {
      nick.readOnly = true;
      nick.value = who.nick;
      twitchBtn.classList.add("hidden");
      switchAcc.classList.remove("hidden");
      idLock.classList.remove("hidden");
      idBadge.classList.remove("hidden");
      idHint.classList.remove("warn");
      idHint.textContent = "Ник из аккаунта " + platformLabel(who.platform) + " — изменить или подделать его нельзя.";
      return;
    }

    idBadge.classList.add("hidden");
    idLock.classList.add("hidden");
    switchAcc.classList.add("hidden");

    if (MANUAL) {
      nick.readOnly = false;
      nick.placeholder = "Например: ProGamer_2007";
      twitchBtn.classList.add("hidden");
      idHint.classList.add("warn");
      idHint.textContent = "⚠ Режим без проверки: ник не подтверждён — сейчас любой может написать от чужого имени.";
      return;
    }

    nick.value = "";
    nick.readOnly = true;
    nick.placeholder = "Нажми кнопку ниже — ник придёт из Twitch";
    twitchBtn.classList.toggle("hidden", !(identity && identity.configured()));
    idHint.classList.toggle("warn", !(identity && identity.configured()));

    var src = sourcePlatform();
    var from = src ? "Переход с " + platformLabel(src) + ". " : "";

    idHint.textContent = (identity && identity.configured())
      ? from + "ник берётся из аккаунта Twitch после входа — вручную его не изменить."
      : "⛔ Авторизация Twitch не настроена: в config.js нужно вписать SETTINGS.twitchClientId. Пока отправка заблокирована.";
  }

  var MAX_NICK = (typeof SETTINGS !== "undefined" && SETTINGS.maxNick) || 40;
  var MAX_MSG = (typeof SETTINGS !== "undefined" && SETTINGS.maxMessage) || 500;
  var COOLDOWN = (typeof SETTINGS !== "undefined" && SETTINGS.cooldown) || 60;
  var COOLDOWN_KEY = "forzes_last_send_" + location.hostname;

  var currentVid = "";
  var cdTimer = null;

  msg.maxLength = MAX_MSG;
  msgMax.textContent = String(MAX_MSG);

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

  function fail(text) {
    statusBox.textContent = text;
    statusBox.classList.add("err");
  }

  /* ---------- кулдаун между отправками ---------- */
  function updateCooldown() {
    var last = 0;
    try { last = Number(localStorage.getItem(COOLDOWN_KEY) || 0); } catch (e) {}
    var left = Math.ceil((last + COOLDOWN * 1000 - Date.now()) / 1000);
    if (left > 0) {
      btn.disabled = true;
      btn.textContent = "⏳ Следующая отправка через " + left + " с";
      if (!cdTimer) cdTimer = window.setInterval(updateCooldown, 1000);
    } else {
      if (cdTimer) { window.clearInterval(cdTimer); cdTimer = null; }
      btn.disabled = false;
      btn.textContent = "🚀 Отправить на обзор";
    }
  }

  /* ---------- живое превью ссылки ---------- */
  link.addEventListener("input", function () {
    var id = extractYouTubeId(link.value);
    if (id) {
      currentVid = id;
      thumb.src = "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
      preview.classList.remove("hidden");
      pvText.textContent = "Видео распознано ✔";
      pvText.className = "pv ok";
    } else if (link.value.trim().length >= 8) {
      currentVid = "";
      preview.classList.remove("hidden");
      pvText.textContent = "Пока не похоже на ссылку YouTube…";
      pvText.className = "pv warn";
    } else {
      currentVid = "";
      preview.classList.add("hidden");
      pvText.textContent = "";
    }
  });

  thumb.addEventListener("error", function () {
    if (preview.classList.contains("hidden")) return;
    pvText.textContent = "Превью не загрузилось — проверь ссылку.";
    pvText.className = "pv warn";
  });

  msg.addEventListener("input", function () {
    counter.textContent = String(msg.value.length);
  });

  if (identity) identity.onChange(renderIdentity);
  renderIdentity();

  twitchBtn.addEventListener("click", function () {
    if (identity) identity.login();
  });

  switchAcc.addEventListener("click", function () {
    if (!identity) return;
    var who = currentIdentity();
    var name = (who && who.nick) || "";
    if (window.confirm("Выйти" + (name ? " из аккаунта " + name : "") + " и войти заново?")) {
      identity.logout();
    }
  });

  /* ник заблокирован: даже если его переписать в консоли,
     в базу всё равно уйдёт подтверждённый логин */
  nick.addEventListener("input", function () {
    var who = currentIdentity();
    if (who && nick.value !== who.nick) nick.value = who.nick;
  });
  nick.addEventListener("paste", function (e) {
    if (nick.readOnly && e.preventDefault) e.preventDefault();
  });
  nick.addEventListener("drop", function (e) {
    if (nick.readOnly && e.preventDefault) e.preventDefault();
  });

  updateCooldown();

  /* ---------- отправка ---------- */
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    statusBox.textContent = "";
    statusBox.classList.remove("err");

    if (hp.value) return; /* скрытое поле — защита от ботов */

    var who = currentIdentity();
    var n = who ? who.nick : nick.value.trim();
    var m = msg.value.trim();
    var id = extractYouTubeId(link.value);

    if (!who && !MANUAL) {
      if (identity && identity.configured()) {
        twitchBtn.classList.remove("hidden");
        fail("Ник можно взять только из аккаунта Twitch: нажми «Войти через Twitch» и отправь видео ещё раз.");
      } else {
        fail("⛔ Авторизация Twitch не настроена — в config.js нужно вписать SETTINGS.twitchClientId. Отправка заблокирована.");
      }
      return;
    }

    if (n.length < 2) { fail("Напиши свой ник (минимум 2 символа)."); nick.focus(); return; }
    if (!id) { fail("Ссылка не похожа на видео YouTube. Пример: https://youtu.be/dQw4w9WgXcQ"); link.focus(); return; }
    /* комментарий к видео — по желанию: пустое поле отправке не мешает */

    var db = initDatabase();
    if (!db) {
      fail("⚠️ Сайт ещё не подключён к базе. Стримеру нужно заполнить config.js (конфиг Firebase).");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Отправляю…";

    var payload = {
      nick: n.slice(0, MAX_NICK),
      message: m.slice(0, MAX_MSG),
      link: "https://youtu.be/" + id,
      vid: id,
      ts: firebase.database.ServerValue.TIMESTAMP
    };

    if (who) {
      payload.platform = who.platform;
      payload.uid = who.userId || "";
      payload.auth = "twitch";
    } else {
      payload.auth = "manual";
    }

    db.ref("submissions").push(payload).then(function () {
      try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) {}
      form.classList.add("hidden");
      success.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function (err) {
      console.error(err);
      fail("Не удалось отправить: " + ((err && err.message) || "ошибка сети") + ". Попробуй ещё раз.");
      btn.disabled = false;
      updateCooldown();
    });
  });

  /* ---------- «отправить ещё одно» ---------- */
  again.addEventListener("click", function () {
    success.classList.add("hidden");
    form.classList.remove("hidden");
    renderIdentity();
    link.value = "";
    msg.value = "";
    counter.textContent = "0";
    currentVid = "";
    preview.classList.add("hidden");
    pvText.textContent = "";
    statusBox.textContent = "";
    updateCooldown();
    nick.focus();
  });

  if (!firebaseConfigured() && setupWarn) {
    setupWarn.classList.remove("hidden");
  }
})();
