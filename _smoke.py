# -*- coding: utf-8 -*-
"""Смоук-тест: прогоняет config.js + identity.js + app.js в Duktape
с минимальным DOM-шимом и проверяет антиподделку ника."""
import io, json, sys, dukpy

def read(p):
    return io.open(p, encoding="utf-8-sig").read()

SHIM = r"""
var __REPORT = [];
function ok(name, cond, extra) {
  __REPORT.push({ name: name, pass: !!cond, extra: (extra === undefined ? null : extra) });
}
function eq(name, got, want) {
  __REPORT.push({ name: name, pass: (got === want), got: got, want: want });
}

/* ---------- DOM ---------- */
var ELEMENTS = {};
var IDS = ["again","btn","cnt","form","hp","idBadge","idHint","idLock","link","msg",
           "msgMax","nick","preview","pvText","setupWarn","status","success",
           "switchAcc","thumb","twitchBtn"];

function makeEl(id) {
  var cls = {}, ev = {};
  var el = {
    id: id, value: "", textContent: "", innerHTML: "", type: "", src: "", href: "",
    title: "", placeholder: "", maxLength: 1000, disabled: false, readOnly: false,
    checked: false, style: {}, _cls: cls,
    addEventListener: function (t, fn) { (ev[t] = ev[t] || []).push(fn); },
    dispatch: function (t, evt) {
      var fns = (ev[t] || []).slice();
      var e = evt || {};
      if (!e.preventDefault) e.preventDefault = function () {};
      e.type = t;
      for (var i = 0; i < fns.length; i++) fns[i](e);
    },
    focus: function () {}, blur: function () {}, click: function () {},
    appendChild: function () {}, removeChild: function () {}, remove: function () {}
  };
  el.classList = {
    add: function (c) { cls[c] = 1; },
    remove: function (c) { delete cls[c]; },
    contains: function (c) { return !!cls[c]; },
    toggle: function (c, on) {
      if (on === undefined) { if (cls[c]) delete cls[c]; else cls[c] = 1; }
      else if (on) { cls[c] = 1; } else { delete cls[c]; }
    }
  };
  return el;
}
for (var i = 0; i < IDS.length; i++) ELEMENTS[IDS[i]] = makeEl(IDS[i]);
function hasCls(id, c) { return !!(ELEMENTS[id] && ELEMENTS[id].classList.contains(c)); }

var document = {
  referrer: "",
  getElementById: function (id) { return ELEMENTS[id] || null; },
  createElement: function (tag) { return makeEl(tag); },
  addEventListener: function () {},
  body: { appendChild: function () {} },
  head: { appendChild: function () {} }
};

/* ---------- хранилища ---------- */
function makeStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    clear: function () { m = {}; },
    _m: m
  };
}
var localStorage = makeStorage();
var sessionStorage = makeStorage();

/* ---------- location / history ---------- */
var location = {
  origin: "https://forzes-video.web.app",
  protocol: "https:",
  hostname: "forzes-video.web.app",
  host: "forzes-video.web.app",
  pathname: "/index.html",
  search: "",
  hash: "",
  href: "https://forzes-video.web.app/index.html",
  assigned: null,
  assign: function (u) { this.assigned = u; }
};
var history = {
  replaceState: function (a, b, url) {
    var s = String(url === undefined ? location.pathname + location.search : url);
    var i = s.indexOf("#");
    location.hash = i < 0 ? "" : s.slice(i);
  }
};
/* ---------- URL / URLSearchParams ---------- */
function URLSearchParams(init) {
  var pairs = [];
  if (typeof init === "string") {
    var s = init.charAt(0) === "?" ? init.slice(1) : init;
    var parts = s.split("&");
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var idx = parts[i].indexOf("=");
      var k = idx < 0 ? parts[i] : parts[i].slice(0, idx);
      var v = idx < 0 ? "" : parts[i].slice(idx + 1);
      pairs.push([decodeURIComponent(k.replace(/\+/g, " ")), decodeURIComponent(v.replace(/\+/g, " "))]);
    }
  } else if (init && typeof init === "object") {
    for (var key in init) {
      if (Object.prototype.hasOwnProperty.call(init, key)) pairs.push([String(key), String(init[key])]);
    }
  }
  this.get = function (k) {
    for (var i = 0; i < pairs.length; i++) if (pairs[i][0] === k) return pairs[i][1];
    return null;
  };
  this.toString = function () {
    var out = [];
    for (var i = 0; i < pairs.length; i++) out.push(encodeURIComponent(pairs[i][0]) + "=" + encodeURIComponent(pairs[i][1]));
    return out.join("&");
  };
}
function URL(input) {
  var s = String(input);
  var m = /^(https?:)\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/.exec(s);
  if (!m) throw new Error("Invalid URL: " + s);
  this.protocol = m[1];
  this.host = m[2];
  this.hostname = m[2].replace(/:\d+$/, "").toLowerCase();
  this.pathname = m[3] || "/";
  this.search = m[4] || "";
  this.hash = m[5] || "";
  var self = this;
  this.searchParams = { get: function (k) { return new URLSearchParams(self.search).get(k); } };
  this.toString = function () { return s; };
}

/* ---------- Promise (минимальная, синхронная) ---------- */
function Promise(exec) {
  var self = this;
  this.state = 0; this.value = undefined; this.queue = [];
  function resolve(v) {
    if (v && typeof v.then === "function") { v.then(resolve, reject); return; }
    self.state = 1; self.value = v; self.flush();
  }
  function reject(e) { self.state = 2; self.value = e; self.flush(); }
  try { exec(resolve, reject); } catch (e) { reject(e); }
}
Promise.prototype.flush = function () {
  var q = this.queue; this.queue = [];
  for (var i = 0; i < q.length; i++) {
    var onOk = q[i][0], onErr = q[i][1], next = q[i][2], self = this;
    try {
      if (self.state === 1) {
        if (typeof onOk === "function") next._resolve(onOk(self.value));
        else next._resolve(self.value);
      } else {
        if (typeof onErr === "function") next._resolve(onErr(self.value));
        else next._reject(self.value);
      }
    } catch (e) { next._reject(e); }
  }
};
Promise.prototype.then = function (onOk, onErr) {
  var next = new Promise(function () {});
  this.queue.push([onOk, onErr, next]);
  if (this.state !== 0) this.flush();
  return next;
};
Promise.prototype["catch"] = function (onErr) { return this.then(null, onErr); };
Promise.prototype._resolve = function (v) {
  var self = this;
  if (v && typeof v.then === "function") {
    v.then(function (x) { self._resolve(x); }, function (e) { self._reject(e); });
    return;
  }
  this.state = 1; this.value = v; this.flush();
};
Promise.prototype._reject = function (e) { this.state = 2; this.value = e; this.flush(); };
Promise.resolve = function (v) { return new Promise(function (res) { res(v); }); };
Promise.reject = function (v) { return new Promise(function (_, rej) { rej(v); }); };

/* ---------- fetch (имитация id.twitch.tv/oauth2/validate) ---------- */
var VALIDATE_STATUS = 200;
var VALIDATE_BODY = { login: "", user_id: "", client_id: "" };
var FETCH_LOG = [];
function fetch(url, opts) {
  FETCH_LOG.push({ url: String(url), auth: opts && opts.headers ? opts.headers.Authorization : "" });
  var st = VALIDATE_STATUS, body = VALIDATE_BODY;
  return new Promise(function (res) {
    res({
      ok: st >= 200 && st < 300,
      status: st,
      json: function () { return new Promise(function (r) { r(body); }); }
    });
  });
}

/* ---------- misc ---------- */
var crypto = {
  getRandomValues: function (a) { for (var i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; }
};
var console = { log: function () {}, warn: function () {}, error: function () {} };
var PUSHED = [];
var firebase = {
  initializeApp: function () { return this; },
  database: function () {
    return {
      ref: function (path) {
        return {
          push: function (data) { PUSHED.push({ path: path, data: data }); return Promise.resolve(data); },
          on: function () {},
          child: function () { return { remove: function () { return Promise.resolve(); } }; }
        };
      }
    };
  }
};
firebase.database.ServerValue = { TIMESTAMP: { ".sv": "serverTimestamp" } };

var window = {
  setInterval: function () { return 1; },
  clearInterval: function () {},
  setTimeout: function () { return 1; },
  clearTimeout: function () {},
  scrollTo: function () {},
  confirm: function () { return true; },
  open: function () {}
};

/* ---------- helpers для проверок ---------- */
function stateOf() {
  return {
    readOnly: ELEMENTS.nick.readOnly,
    nickValue: ELEMENTS.nick.value,
    twitchBtnHidden: hasCls("twitchBtn", "hidden"),
    badgeHidden: hasCls("idBadge", "hidden"),
    lockHidden: hasCls("idLock", "hidden"),
    switchHidden: hasCls("switchAcc", "hidden"),
    hint: ELEMENTS.idHint.textContent,
    status: ELEMENTS.status.textContent,
    hasErr: ELEMENTS.status.classList.contains("err"),
    assignedUrl: location.assigned
  };
}
function fillAndSubmit(link) {
  ELEMENTS.link.value = link;
  ELEMENTS.form.dispatch("submit", {});
}
"""
def build(pre_storage="", pre_config="", actions="", checks=""):
    config = read("config.js").replace("const ", "var ")
    identity = read("identity.js")
    app = read("app.js")
    return "\n".join([
        SHIM, pre_storage, config, pre_config, identity, app, actions, checks,
        "JSON.stringify(__REPORT);"
    ])

def run(title, **kw):
    out = dukpy.evaljs(build(**kw))
    report = json.loads(out)
    bad = [r for r in report if not r["pass"]]
    print(("FAIL " if bad else "OK   ") + title)
    for r in bad:
        print("       x", r)
    return not bad

all_ok = True

# 1) авторизация не настроена: поле заблокировано, отправка заблокирована
all_ok &= run(
    "1. Client-ID не заполнен → отправка заблокирована",
    pre_config='SETTINGS.twitchClientId = "";',
    checks=r"""
      var s = stateOf();
      eq("1 readOnly", s.readOnly, true);
      eq("1 пустой ник", s.nickValue, "");
      eq("1 кнопка входа спрятана", s.twitchBtnHidden, true);
      eq("1 замочек спрятан", s.lockHidden, true);
      eq("1 подсказка", s.hint.indexOf("не настроена") >= 0, true);
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
      eq("1 ничего не ушло в базу", PUSHED.length, 0);
      eq("1 ошибка показана", stateOf().status.indexOf("не настроена") >= 0, true);
    """
)

# 2) есть Client-ID, входа нет: поле заблокировано, кнопка видна, отправка ждёт входа
all_ok &= run(
    "2. Client-ID есть, не вошёл → нельзя отправить",
    pre_config='SETTINGS.twitchClientId = "test_cid";',
    checks=r"""
      var s = stateOf();
      eq("2 readOnly", s.readOnly, true);
      eq("2 кнопка входа видна", s.twitchBtnHidden, false);
      eq("2 подсказка про вход", s.hint.indexOf("после входа") >= 0, true);
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
      eq("2 в базу ничего не ушло", PUSHED.length, 0);
      eq("2 ошибка про вход", stateOf().status.indexOf("Войти через Twitch") >= 0, true);
    """
)

# 3) вошёл: ник подставился, заблокирован, подмена не работает
all_ok &= run(
    "3. Вход через Twitch → ник подтверждён и подделать нельзя",
    pre_storage=r"""
      localStorage.setItem("forzes_ident_forzes-video.web.app",
        JSON.stringify({platform:"twitch", nick:"realuser", userId:"12345", ts:1}));
      localStorage.setItem("forzes_twitch_token_forzes-video.web.app", "TOKEN123");
      VALIDATE_BODY = { login: "realuser", user_id: "12345", client_id: "test_cid" };
    """,
    pre_config='SETTINGS.twitchClientId = "test_cid";',
    actions=r"""
      ELEMENTS.nick.value = "victim";
      ELEMENTS.nick.dispatch("input");
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
    """,
    checks=r"""
      var s = stateOf();
      eq("3 readOnly", s.readOnly, true);
      eq("3 ник остался настоящим", s.nickValue, "realuser");
      eq("3 бейдж виден", s.badgeHidden, false);
      eq("3 замочек виден", s.lockHidden, false);
      eq("3 кнопка смены аккаунта видна", s.switchHidden, false);
      eq("3 ровно одна отправка", PUSHED.length, 1);
      eq("3 nick в базе = настоящий", PUSHED[0].data.nick, "realuser");
      eq("3 platform", PUSHED[0].data.platform, "twitch");
      eq("3 uid", PUSHED[0].data.uid, "12345");
      eq("3 auth", PUSHED[0].data.auth, "twitch");
      eq("3 ссылка", PUSHED[0].data.link, "https://youtu.be/dQw4w9WgXcQ");
      eq("3 токен проверялся у Twitch", FETCH_LOG.length > 0, true);
      eq("3 валидация на id.twitch.tv",
         FETCH_LOG[0].url.indexOf("https://id.twitch.tv/oauth2/validate") === 0, true);
    """
)
# 4) возврат с Twitch с правильным state → логин берётся из validate
all_ok &= run(
    "4. Возврат с Twitch (#access_token) → ник из API",
    pre_storage=r"""
      sessionStorage.setItem("forzes_twitch_oauth_state", "ABCDEF");
      location.hash = "#access_token=TOK123&token_type=bearer&state=ABCDEF";
      VALIDATE_BODY = { login: "from_twitch", user_id: "777", client_id: "test_cid" };
    """,
    pre_config='SETTINGS.twitchClientId = "test_cid";',
    checks=r"""
      var idn = window.identity.current();
      eq("4 личность есть", !!idn, true);
      eq("4 ник из Twitch", idn.nick, "from_twitch");
      eq("4 userId", idn.userId, "777");
      eq("4 платформа", idn.platform, "twitch");
      eq("4 поле заблокировано", stateOf().readOnly, true);
      eq("4 поле показывает ник", stateOf().nickValue, "from_twitch");
      eq("4 токен убран из адресной строки", location.hash.indexOf("access_token") < 0, true);
      eq("4 токен сохранён",
         localStorage.getItem("forzes_twitch_token_forzes-video.web.app"), "TOK123");
      eq("4 запрос ушёл с Authorization",
         FETCH_LOG[0].auth.indexOf("OAuth TOK123") === 0, true);
    """
)

# 5) возврат с чужим state → личность не принимается
all_ok &= run(
    "5. Подмена state → личность отвергается",
    pre_storage=r"""
      sessionStorage.setItem("forzes_twitch_oauth_state", "GOOD");
      location.hash = "#access_token=TOK123&state=EVIL";
      VALIDATE_BODY = { login: "hacker", user_id: "666", client_id: "test_cid" };
    """,
    pre_config='SETTINGS.twitchClientId = "test_cid";',
    checks=r"""
      eq("5 личности нет", window.identity.current(), null);
      eq("5 поле заблокировано", stateOf().readOnly, true);
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
      eq("5 отправка без личности заблокирована", PUSHED.length, 0);
    """
)

# 6) аварийный ручной режим (allowManualNick)
all_ok &= run(
    "6. allowManualNick=true → старый режим (только для теста)",
    pre_config='SETTINGS.twitchClientId = "test_cid"; SETTINGS.allowManualNick = true;',
    actions=r"""
      ELEMENTS.nick.value = "ManualGuy";
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
    """,
    checks=r"""
      eq("6 поле редактируемое", stateOf().readOnly, false);
      eq("6 ушло в базу", PUSHED.length, 1);
      eq("6 nick из поля", PUSHED[0].data.nick, "ManualGuy");
      eq("6 помечено как непроверенное", PUSHED[0].data.auth, "manual");
      eq("6 предупреждение показано", stateOf().hint.indexOf("не подтверждён") >= 0, true);
    """
)

# 7) Twitch отозвал токен (401) → личность снимается
all_ok &= run(
    "7. Токен отозван (401) → вход сбрасывается",
    pre_storage=r"""
      localStorage.setItem("forzes_ident_forzes-video.web.app",
        JSON.stringify({platform:"twitch", nick:"olduser", userId:"1", ts:1}));
      localStorage.setItem("forzes_twitch_token_forzes-video.web.app", "DEADTOKEN");
      VALIDATE_STATUS = 401;
      VALIDATE_BODY = { message: "invalid access token" };
    """,
    pre_config='SETTINGS.twitchClientId = "test_cid";',
    checks=r"""
      eq("7 личность снята", window.identity.current(), null);
      eq("7 поле заблокировано", stateOf().readOnly, true);
      eq("7 токен удалён",
         localStorage.getItem("forzes_twitch_token_forzes-video.web.app"), null);
      fillAndSubmit("https://youtu.be/dQw4w9WgXcQ");
      eq("7 отправить не удалось", PUSHED.length, 0);
    """
)

print("")
print("ВСЕ СЦЕНАРИИ ПРОШЛИ" if all_ok else "ЕСТЬ ОШИБКИ")
sys.exit(0 if all_ok else 1)
