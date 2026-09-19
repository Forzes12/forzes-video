/* Панель заявок (dashboard.html) — вход по паролю */
(function () {
  "use strict";

  window.studioGate ? window.studioGate.require(run) : run();

  function run() {

  function $(id) { return document.getElementById(id); }

  var list = $("list");
  var countEl = $("count");
  var errBox = $("err");
  var db = initDatabase();
  var ref = null;
  var items = {}; /* key -> { root, data } */

  function showError(text) {
    errBox.textContent = text;
    errBox.classList.remove("hidden");
  }

  function fmtTime(ts) {
    try {
      return new Date(ts).toLocaleString("ru-RU", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return ""; }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- «поделиться»: сразу копируем ссылку на видео в буфер обмена ---------- */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", ""); /* чтобы iOS не скроллила и не меняла раскладку */
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (e) {} /* для мобильных */
    var okFlag = false;
    try { okFlag = document.execCommand("copy"); } catch (e) { okFlag = false; }
    document.body.removeChild(ta);
    return okFlag;
  }

  function shareVideo(data, vid, btn) {
    var url = data.link || ("https://youtu.be/" + (vid || ""));
    if (!url) return;

    function done(text) {
      btn.textContent = text;
      btn.disabled = true;
      window.setTimeout(function () {
        btn.textContent = "🔗 Поделиться";
        btn.disabled = false;
      }, 1600);
    }
    function ok() { done("✅ Скопировано!"); }
    function fail() { done("⚠ Не удалось"); }

    /* сначала — современный Clipboard API, при отказе — запасной способ */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, function () {
        legacyCopy(url) ? ok() : fail();
      });
    } else {
      legacyCopy(url) ? ok() : fail();
    }
  }

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

  function recount() {
    countEl.textContent = String(Object.keys(items).length);
  }

  function add(key, data) {
    if (!data || items[key]) return;

    var item = el("div", "item");

    var vid = data.vid || extractYouTubeId(data.link);
    var img = document.createElement("img");
    img.alt = "";
    if (vid) img.src = "https://i.ytimg.com/vi/" + vid + "/mqdefault.jpg";
    item.appendChild(img);

    var info = el("div", "info");

    var top = el("div", "top");
    top.appendChild(el("span", "nick", data.nick || "Без имени"));
    top.appendChild(el("span", "time", fmtTime(data.ts)));
    info.appendChild(top);

    info.appendChild(el("div", "desc", data.message || "—"));

    var acts = el("div", "acts");

    var open = el("a", "linkbtn", "▶ Открыть видео");
    open.href = data.link || ("https://youtu.be/" + (vid || ""));
    open.target = "_blank";
    open.rel = "noopener";
    acts.appendChild(open);

    var sh = el("button", "sh", "🔗 Поделиться");
    sh.type = "button";
    sh.addEventListener("click", function () { shareVideo(data, vid, sh); });
    acts.appendChild(sh);

    var del = el("button", "del", "✕ Удалить");
    del.type = "button";
    del.addEventListener("click", function () {
      if (!window.confirm("Удалить заявку от «" + (data.nick || "?") + "»?")) return;
      ref.child(key).remove().then(null, function (err) {
        showError("Не удалось удалить: " + ((err && err.message) || "ошибка"));
      });
    });
    acts.appendChild(del);

    info.appendChild(acts);
    item.appendChild(info);

    list.insertBefore(item, list.firstChild); /* новые — сверху */
    items[key] = { root: item, data: data };
    recount();
  }

  function removeItem(key) {
    var it = items[key];
    if (!it) return;
    if (it.root.parentNode) it.root.parentNode.removeChild(it.root);
    delete items[key];
    recount();
  }

  $("refresh").addEventListener("click", function () { location.reload(); });

  if (!db) {
    showError("База не подключена: заполни config.js (конфиг Firebase).");
    return;
  }

  ref = db.ref("submissions");

  ref.on("child_added", function (snap) {
    add(snap.key, snap.val());
  }, function (err) {
    showError("Нет доступа к базе: " + ((err && err.message) || "ошибка") +
      ". Проверь правила доступа в Firebase (Realtime Database → Rules) — тестовый режим действует 30 дней.");
  });

  ref.on("child_removed", function (snap) {
    removeItem(snap.key);
  });

  }
})();
