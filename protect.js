(function () {
  "use strict";

  /* ---------- запрет инспекции ---------- */
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();

    if (k === "f12") {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
      e.preventDefault();
      return;
    }

    if (e.ctrlKey && (k === "u" || k === "s")) {
      e.preventDefault();
      return;
    }
  });

  var st = document.createElement("style");

  st.textContent =
    "*{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}" +
    "input,textarea{-webkit-user-select:text!important;user-select:text!important}";

  document.head.appendChild(st);

  /* ---------- вход по паролю ---------- */

  /*
    Новый пароль:
    F0rz3s!@#2023^&Secur1tyyui

    SHA-256:
    8c9d3a99ef04df9ff53ba733332db0421fe1729a91982368639299793a1c4ac3
  */

  var HASH = "8c9d3a99ef04df9ff53ba733332db0421fe1729a91982368639299793a1c4ac3";

  var LS_KEY = "forzes_studio_ok";
  var overlay = null;

  /* Пароль теперь спрашивается при каждом заходе.
     Стираем старую метку «уже вошёл», если она осталась с прошлых версий. */
  try { localStorage.removeItem(LS_KEY); } catch (e) {}

  function sha256hex(str) {
    return crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(str)
    ).then(function (buf) {
      return Array.prototype.map.call(
        new Uint8Array(buf),
        function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }
      ).join("");
    });
  }

  function build() {
    overlay = document.createElement("div");

    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;" +
      "background:rgba(7,9,18,.93);" +
      "backdrop-filter:blur(6px);" +
      "display:flex;align-items:center;justify-content:center";

    var card = document.createElement("div");

    card.style.cssText =
      "width:340px;max-width:92vw;" +
      "background:#12162a;" +
      "border:1px solid rgba(139,92,246,.5);" +
      "border-radius:18px;" +
      "padding:28px 24px;" +
      "color:#eef1ff;" +
      "box-shadow:0 20px 60px rgba(0,0,0,.6);" +
      "text-align:center;" +
      "font-family:Rubik,system-ui,sans-serif";

    var icon = document.createElement("div");

    icon.style.cssText =
      "font-size:40px;line-height:1;margin-bottom:10px";

    icon.textContent = "🔒";
    card.appendChild(icon);

    var h = document.createElement("div");

    h.style.cssText =
      "font-size:17px;font-weight:900;margin-bottom:6px";

    h.textContent = "Зона стримера";
    card.appendChild(h);

    var p = document.createElement("div");

    p.style.cssText =
      "font-size:12.5px;color:#9aa3c7;" +
      "line-height:1.5;margin-bottom:16px";

    p.textContent =
      "Эта страница только для Forzes. Введи пароль, чтобы продолжить.";

    card.appendChild(p);

    var input = document.createElement("input");

    input.type = "password";
    input.placeholder = "Пароль";
    input.autocomplete = "off";

    input.style.cssText =
      "width:100%;" +
      "background:rgba(255,255,255,.06);" +
      "border:1px solid rgba(255,255,255,.12);" +
      "border-radius:11px;" +
      "padding:12px 14px;" +
      "color:#eef1ff;" +
      "font:inherit;" +
      "font-size:14px;" +
      "outline:none;" +
      "text-align:center;" +
      "letter-spacing:.15em";

    input.addEventListener("focus", function () {
      input.style.borderColor = "#8b5cf6";
    });

    input.addEventListener("blur", function () {
      input.style.borderColor = "rgba(255,255,255,.12)";
    });

    card.appendChild(input);

    var btn = document.createElement("button");

    btn.type = "button";
    btn.textContent = "Войти";

    btn.style.cssText =
      "width:100%;" +
      "margin-top:12px;" +
      "padding:12px;" +
      "border:none;" +
      "border-radius:11px;" +
      "font:inherit;" +
      "font-weight:700;" +
      "font-size:14px;" +
      "color:#fff;" +
      "background:linear-gradient(90deg,#7c3aed,#2563eb);" +
      "cursor:pointer";

    card.appendChild(btn);

    var err = document.createElement("div");

    err.style.cssText =
      "min-height:18px;" +
      "margin-top:10px;" +
      "font-size:12.5px;" +
      "color:#f87171";

    card.appendChild(err);

    var shake = document.createElement("style");

    shake.textContent =
      "@keyframes gateShake{" +
      "0%,100%{transform:translateX(0)}" +
      "25%{transform:translateX(-9px)}" +
      "75%{transform:translateX(9px)}" +
      "}";

    document.head.appendChild(shake);

    function fail(msg) {
      err.textContent = msg;

      card.style.animation = "none";

      void card.offsetWidth;

      card.style.animation = "gateShake .35s";
    }

    function attempt() {
      var v = input.value;

      if (!v) {
        fail("Введи пароль.");
        return;
      }

      if (!window.crypto || !crypto.subtle) {
        fail(
          "Открой сайт в обычном браузере (Chrome/Edge) по ссылке https."
        );
        return;
      }

      btn.disabled = true;
      btn.textContent = "Проверяю…";

      sha256hex(v).then(function (hex) {

        if (hex === HASH) {

          /* вход не запоминаем — при следующем заходе пароль спросится снова */

          overlay.parentNode.removeChild(overlay);
          overlay = null;

          done();

        } else {

          btn.disabled = false;
          btn.textContent = "Войти";

          fail("Неверный пароль.");

          input.value = "";
          input.focus();
        }

      })["catch"](function () {

        btn.disabled = false;
        btn.textContent = "Войти";

        fail("Ошибка проверки. Попробуй ещё раз.");
      });
    }

    btn.addEventListener("click", attempt);

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        attempt();
      }
    });

    overlay.appendChild(card);

    return input;
  }

  function show() {

    if (!overlay) {

      var input = build();

      document.body.appendChild(overlay);

      window.setTimeout(function () {
        input.focus();
      }, 60);
    }
  }

  var pending = null;

  function ask(then) {

    pending = then;

    if (document.body) {
      show();
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        show();
      });
    }
  }

  window.studioGate = {

    /* SHA-256-хеш пароля — settings.html вставляет его в ссылку виджета как ?key=... */
    hash: HASH,

    /* без запоминания: пароль запрашивается при каждом открытии страницы */
    require: function (then) {
      ask(then);
    },

    /* тихий вход по ключу в ссылке (?key=...) — для виджета в OBS.
       Ключ — это хеш пароля: OBS открывает виджет без вопросов,
       а все остальные видят запрос пароля. */
    requireKey: function (then) {

      var k = null;

      try {
        k = new URLSearchParams(location.search).get("key");
      } catch (e) {}

      if (k && k === HASH) {
        then();
        return;
      }

      ask(then);
    }
  };

  function done() {

    if (pending) {

      var f = pending;

      pending = null;

      f();
    }
  }

})();