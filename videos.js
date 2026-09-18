/* Мои видео (videos.html) — вход по паролю.
   Список всех присланных видео: ничего не пропадает, пока сам не удалишь.
   Можно скроллить, искать, делиться ссылкой и удалять. Новые приходят сами. */
(function () {
  "use strict";

  window.studioGate ? window.studioGate.require(run) : run();

  function run() {

  function $(id) { return document.getElementById(id); }

  var list = $("list");
  var statEl = $("stat");
  var emptyEl = $("empty");
  var errBox = $("err");
  var searchEl = $("search");
  var db = initDatabase();
  var ref = null;
  var items = {}; /* key -> { root, data } */

  var EMPTY_TEXT = "Пока никто не прислал видео. Как только зритель отправит ссылку — она появится здесь (и уведомлением в OBS).";

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

  /* ---------- поиск и счётчик ---------- */
  function applyFilter() {
    var q = (searchEl.value || "").trim().toLowerCase();
    var keys = Object.keys(items);
    var vis = 0;
    for (var i = 0; i < keys.length; i++) {
      var it = items[keys[i]];
      var hay = ((it.data.nick || "") + " " + (it.data.message || "")).toLowerCase();
      var show = !q || hay.indexOf(q) >= 0;
      it.root.style.display = show ? "" : "none";
      if (show) vis++;
    }
    if (q) {
      statEl.textContent = "Найдено: " + vis + " из " + keys.length;
      emptyEl.textContent = "Ничего не найдено по запросу «" + searchEl.value.trim() + "».";
      emptyEl.classList.toggle("hidden", vis !== 0);
    } else {
      statEl.textContent = "Всего: " + keys.length;
      emptyEl.textContent = EMPTY_TEXT;
      emptyEl.classList.toggle("hidden", keys.length !== 0);
    }
  }

  searchEl.addEventListener("input", applyFilter);

  /* ---------- «поделиться»: системное меню или копирование ссылки ---------- */
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function share(data, btn) {
    var vid = data.vid || extractYouTubeId(data.link) || "";
    var url = data.link || ("https://youtu.be/" + vid);

    if (navigator.share) {
      navigator.share({ title: "Видео от " + (data.nick || "зрителя"), url: url })["catch"](function () {});
      return;
    }

    function ok() {
      btn.textContent = "✅ Скопировано!";
      btn.disabled = true;
      window.setTimeout(function () {
        btn.textContent = "🔗 Поделиться";
        btn.disabled = false;
      }, 1600);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, function () { legacyCopy(url); ok(); });
    } else {
      legacyCopy(url);
      ok();
    }
  }

  /* ---------- карточка видео ---------- */
  function add(key, data) {
    if (!data || items[key]) return;

    var vid = data.vid || extractYouTubeId(data.link);
    var link = data.link || ("https://youtu.be/" + (vid || ""));

    var item = el("div", "item");

    var box = el("div", "thumbbox");
    var img = document.createElement("img");
    img.alt = "";
    if (vid) img.src = "https://i.ytimg.com/vi/" + vid + "/mqdefault.jpg";
    box.appendChild(img);
    box.appendChild(el("span", "play", "▶"));
    box.title = "Открыть видео";
    box.style.cursor = "pointer";
    box.addEventListener("click", function () {
      window.open(link, "_blank", "noopener");
    });
    item.appendChild(box);

    var info = el("div", "info");

    var top = el("div", "top");
    top.appendChild(el("span", "nick", data.nick || "Без имени"));
    top.appendChild(el("span", "time", fmtTime(data.ts)));
    info.appendChild(top);

    info.appendChild(el("div", "desc", data.message || "—"));

    var acts = el("div", "acts");

    var sh = el("button", "sh", "🔗 Поделиться");
    sh.type = "button";
    sh.addEventListener("click", function () { share(data, sh); });
    acts.appendChild(sh);

    var open = el("a", "linkbtn", "▶ Открыть");
    open.href = link;
    open.target = "_blank";
    open.rel = "noopener";
    acts.appendChild(open);

    var del = el("button", "del", "✕ Удалить");
    del.type = "button";
    del.addEventListener("click", function () {
      if (!window.confirm("Удалить видео от «" + (data.nick || "?") + "»? Оно исчезнет и отсюда, и из уведомлений OBS, и с панели заявок.")) return;
      ref.child(key).remove().then(null, function (err) {
        showError("Не удалось удалить: " + ((err && err.message) || "ошибка"));
      });
    });
    acts.appendChild(del);

    info.appendChild(acts);
    item.appendChild(info);

    list.insertBefore(item, list.firstChild); /* новые — сверху */
    items[key] = { root: item, data: data };
    applyFilter(); /* применит активный поиск и обновит счётчик */
  }

  function removeItem(key) {
    var it = items[key];
    if (!it) return;
    if (it.root.parentNode) it.root.parentNode.removeChild(it.root);
    delete items[key];
    applyFilter();
  }

  $("refresh").addEventListener("click", function () { location.reload(); });

  applyFilter(); /* стартовое состояние: «Всего: 0» / пустой список */

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
