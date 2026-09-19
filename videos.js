/* Мои видео (videos.html) — вход по паролю.
   Список всех присланных видео: ничего не пропадает, пока сам не удалишь.
   Можно скроллить, искать, делиться ссылкой, смотреть и удалять.
   Новые приходят сами, без обновления страницы. Пока вкладка не видна,
   видео не показываются — при возврате каскадом выплывают справа, без звука.
   «▶ Смотреть» открывает видео и запускает полосу-таймер снизу: когда полоса
   истекает, карточка плавно убирается сама (как при удалении). */
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

  /* ---------- «Смотреть»: настройки ---------- */
  var WATCH_SECONDS = 15;   /* сколько секунд идёт полоса снизу */
  var WATCH_DELETES = true; /* true — когда полоса кончилась, видео удаляется совсем (как кнопкой «Удалить»); false — карточка исчезает только со страницы */

  /* пока вкладка не видна — новые видео копятся здесь и не показываются */
  var pending = [];
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || !pending.length) return;
    var q = pending;
    pending = [];
    for (var i = 0; i < q.length; i++) add(q[i].key, q[i].data); /* каскад справа, без звука */
  });

  /* задержка старта анимации, чтобы карточки появлялись плавной волной */
  var staggerIdx = 0, staggerIdle = null;
  function nextDelay() {
    if (staggerIdle) window.clearTimeout(staggerIdle);
    var d = Math.min(staggerIdx, 12) * 80;
    staggerIdx++;
    staggerIdle = window.setTimeout(function () { staggerIdx = 0; }, 700);
    return d;
  }

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
      statEl.textContent = "Всего: " + keys.length + (pending.length ? " · +" + pending.length + " новых" : "");
      emptyEl.textContent = EMPTY_TEXT;
      emptyEl.classList.toggle("hidden", keys.length !== 0);
    }
  }

  searchEl.addEventListener("input", applyFilter);

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

  function share(data, btn) {
    var vid = data.vid || extractYouTubeId(data.link) || "";
    var url = data.link || ("https://youtu.be/" + vid);
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

    var open = el("button", "linkbtn", "▶ Смотреть");
    open.type = "button";
    open.title = "Открыть видео и запустить обратный отсчёт";
    open.addEventListener("click", function () {
      window.open(link, "_blank", "noopener");
      startWatch(item, key);
    });
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

    /* плавное появление справа (без звука) */
    item.style.animationDelay = nextDelay() + "ms";
    item.classList.add("in");

    list.insertBefore(item, list.firstChild); /* новые — сверху */
    items[key] = { root: item, data: data };
    applyFilter(); /* применит активный поиск и обновит счётчик */
  }

  function removeItem(key) {
    var it = items[key];
    if (!it || it.removing) return;
    it.removing = true;
    delete items[key];
    stopWatch(it.root);

    /* плавное исчезновение: влево + схлопывание высоты */
    var root = it.root;
    root.style.maxHeight = root.offsetHeight + "px"; /* фиксируем высоту для схлопывания */
    root.classList.add("out");
    window.setTimeout(function () {
      if (root.parentNode) root.parentNode.removeChild(root);
    }, 480);
    applyFilter();
  }

  /* ---------- «Смотреть»: полоса-таймер снизу, по окончании видео убирается ---------- */
  function stopWatch(item) {
    var w = item._watch;
    if (!w) return;
    if (w.fallback) window.clearTimeout(w.fallback);
    item._watch = null;
  }

  function finishWatch(key, item) {
    stopWatch(item);
    removeItem(key); /* та же плавная анимация, что при удалении */
    if (WATCH_DELETES && ref) {
      ref.child(key).remove().then(null, function (err) {
        showError("Видео убрано со страницы, но удалить из базы не удалось: " + ((err && err.message) || "ошибка"));
      });
    }
  }

  function startWatch(item, key) {
    stopWatch(item);
    var old = item.querySelector(".bar");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var bar = el("div", "bar");
    var fill = el("span", "bar-fill");
    bar.appendChild(fill);
    item.appendChild(bar);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      finishWatch(key, item); /* полоса кончилась → убрать видео */
    }

    item._watch = { fallback: null };
    fill.addEventListener("transitionend", function (ev) {
      if (ev.propertyName === "width") finish();
    });
    item._watch.fallback = window.setTimeout(finish, WATCH_SECONDS * 1000 + 500);

    /* полоса тает справа налево: ширина 100% → 0 линейно */
    void fill.offsetWidth; /* reflow, чтобы transition точно сработал */
    fill.style.transition = "width " + WATCH_SECONDS + "s linear";
    fill.style.width = "0%";
  }

  $("refresh").addEventListener("click", function () { location.reload(); });

  applyFilter(); /* стартовое состояние: «Всего: 0» / пустой список */

  if (!db) {
    showError("База не подключена: заполни config.js (конфиг Firebase).");
    return;
  }

  ref = db.ref("submissions");

  ref.on("child_added", function (snap) {
    var key = snap.key;
    var data = snap.val();
    if (document.hidden) {
      /* вкладка не на экране — видео не приходит, ждём возврата */
      for (var i = 0; i < pending.length; i++) if (pending[i].key === key) return;
      if (!items[key]) pending.push({ key: key, data: data });
      applyFilter();
      return;
    }
    add(key, data);
  }, function (err) {
    showError("Нет доступа к базе: " + ((err && err.message) || "ошибка") +
      ". Проверь правила доступа в Firebase (Realtime Database → Rules) — тестовый режим действует 30 дней.");
  });

  ref.on("child_removed", function (snap) {
    removeItem(snap.key);
  });

  }
})();
