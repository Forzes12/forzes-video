/* Личность посетителя: ник берётся из аккаунта Twitch (OAuth),
   а не вводится руками — под чужим именем видео не отправить.

   Как это работает:
   1) человек жмёт «Войти через Twitch» и подтверждает аккаунт на twitch.tv;
   2) Twitch возвращает access_token в адресной строке (#access_token=...);
   3) токен проверяется на https://id.twitch.tv/oauth2/validate —
      оттуда приходит настоящий логин (login) и числовой id пользователя;
   4) логин ложится в localStorage и подставляется в форму как readonly-поле;
   5) при отправке в базу уходит именно этот логин, а не то, что в инпуте.

   API: window.identity = { current, configured, onChange, login, logout } */
(function () {
  "use strict";

  var LS_IDENT = "forzes_ident_" + location.hostname;
  var LS_TOKEN = "forzes_twitch_token_" + location.hostname;
  var SS_STATE = "forzes_twitch_oauth_state";

  var current = null;
  var listeners = [];

  function clientId() {
    try {
      return (typeof SETTINGS !== "undefined" && SETTINGS.twitchClientId) || "";
    } catch (e) { return ""; }
  }

  function saveIdent(o) { try { localStorage.setItem(LS_IDENT, JSON.stringify(o)); } catch (e) {} }
  function loadIdent() { try { return JSON.parse(localStorage.getItem(LS_IDENT) || "null"); } catch (e) { return null; } }
  function saveToken(t) { try { localStorage.setItem(LS_TOKEN, t); } catch (e) {} }
  function loadToken() { try { return localStorage.getItem(LS_TOKEN) || ""; } catch (e) { return ""; } }

  function forget() {
    try { localStorage.removeItem(LS_IDENT); localStorage.removeItem(LS_TOKEN); } catch (e) {}
    current = null;
    emit();
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](current); } catch (e) {}
    }
  }

  function setIdent(o) {
    current = o;
    if (o) saveIdent(o);
    emit();
  }

  /* ---------- проверка токена у Twitch ---------- */
  function validate(token) {
    return fetch("https://id.twitch.tv/oauth2/validate", {
      headers: { Authorization: "OAuth " + token }
    }).then(function (res) {
      if (res.status === 401) { forget(); return null; }   /* токен отозван/протух */
      if (!res.ok) { throw new Error("validate " + res.status); }
      return res.json();
    }).then(function (d) {
      if (!d) return;
      if (!d.login) { forget(); return; }
      setIdent({
        platform: "twitch",
        nick: String(d.login).slice(0, 40),
        userId: String(d.user_id || ""),
        ts: Date.now()
      });
    })["catch"](function () {
      /* временный сбой сети — оставляем последнюю подтверждённую личность */
      var saved = loadIdent();
      if (saved) current = saved;
      emit();
    });
  }

  /* ---------- переход на авторизацию Twitch ---------- */
  function redirectUri() {
    return location.origin + location.pathname;
  }

  function login() {
    var cid = clientId();
    if (!cid) {
      console.warn("identity: в config.js не заполнен SETTINGS.twitchClientId");
      return;
    }

    var state = "";
    try {
      var arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      state = Array.prototype.map.call(arr, function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
      sessionStorage.setItem(SS_STATE, state);
    } catch (e) {}

    var q = new URLSearchParams({
      client_id: cid,
      redirect_uri: redirectUri(),
      response_type: "token",
      scope: "",
      force_verify: "true",
      state: state
    });

    location.assign("https://id.twitch.tv/oauth2/authorize?" + q.toString());
  }

  /* ---------- возврат с Twitch: #access_token=... ---------- */
  function handleHash() {
    var raw = location.hash || "";
    if (raw.length < 2) return;

    var params;
    try { params = new URLSearchParams(raw.slice(1)); } catch (e) { return; }

    var token = params.get("access_token");
    if (!token) return;

    var state = params.get("state") || "";
    var expected = "";
    try {
      expected = sessionStorage.getItem(SS_STATE) || "";
      sessionStorage.removeItem(SS_STATE);
    } catch (e) {}

    /* убираем токен из адресной строки, чтобы его не увидели другие */
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }

    if (state !== expected) { forget(); return; }   /* защита от подмены (CSRF) */

    saveToken(token);
    validate(token);
  }

  /* ---------- старт ---------- */
  handleHash();

  var saved = loadIdent();
  if (saved) current = saved;

  var tok = loadToken();
  if (tok) {
    validate(tok);
  } else {
    emit();
  }

  window.identity = {
    current: function () { return current; },
    configured: function () { return !!clientId(); },
    onChange: function (cb) { if (typeof cb === "function") listeners.push(cb); },
    login: login,
    logout: function () { forget(); login(); },
    revalidate: function () { var t = loadToken(); if (t) validate(t); }
  };
})();
