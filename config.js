/* ============================================================
   FORZES STREAM — НАСТРОЙКА САЙТА
   ------------------------------------------------------------
   ЧТОБЫ ВСЁ ЗАРАБОТАЛО, НУЖНО СДЕЛАТЬ 2 ВЕЩИ:

   1) Создай бесплатную базу Firebase (5 минут, см. README.md, Шаг 1):
      - открой https://console.firebase.google.com
      - «Создать проект» → назови, например, forzes-video
      - слева в меню: Build → Realtime Database → Create Database
      - выбери локацию → «Start in test mode» → Enable
      - шестерёнка (Project settings) → Your apps → иконка </> (Web)
        → Register app → появится блок firebaseConfig

   2) ВСТАВЬ значения из этого блока НИЖЕ вместо слов ВСТАВЬ_СЮДА_...

      ВАЖНО: параметра databaseURL в блоке может не быть — тогда
      впиши его сам, он показан вверху страницы Realtime Database,
      выглядит так:
      https://ИМЯ-ПРОЕКТА-default-rtdb.firebaseio.com
      (или https://...-default-rtdb.europe-west1.firebasedatabase.app)
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB45SyyG_GZvpoIvPZjLBceOEVrN8cxGCdA",
  authDomain: "forzes-video.firebaseapp.com",
  databaseURL: "https://forzes-video-default-rtdb.firebaseio.com",
  projectId: "forzes-video",
  storageBucket: "forzes-video.firebasestorage.app",
  messagingSenderId: "769774353953",
  appId: "1:769774353953:web:9d5161d861220b68342d60"
};

/* ------------------------------------------------------------
   ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ (можно не трогать)
   ------------------------------------------------------------ */
const SETTINGS = {
  /* Уведомления в OBS (widget.html): */
  sound: true,        // играть ли звук при новой заявке
  volume: 0.3,        // громкость звука: 0.0 ... 1.0 (сейчас тихий и мягкий)
  duration: 0,        // 0 = карточка висит, пока не скипнешь (кнопка ✕) или не нажмёшь «Смотреть видео»;
                      // поставь число (например 14) — и карточка сама исчезнет через 14 секунд
  maxOnScreen: 5,     // максимум карточек на экране одновременно

  /* Форма отправки (index.html): */
  cooldown: 60,       // секунд до повторной отправки у зрителя
  maxNick: 40,        // максимальная длина ника
  maxMessage: 500     // максимальная длина описания
};

/* ------------------------------------------------------------
   ДАЛЬШЕ СЛУЖЕБНЫЙ КОД — НЕ ИЗМЕНЯЙ
   ------------------------------------------------------------ */
function firebaseConfigured() {
  const c = FIREBASE_CONFIG || {};
  if (!c.apiKey || !c.databaseURL) return false;
  if (/ВСТАВЬ_СЮДА/.test(String(c.apiKey) + String(c.databaseURL))) return false;
  return /^https?:\/\/.+/.test(String(c.databaseURL));
}

function initDatabase() {
  if (!firebaseConfigured()) return null;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    return firebase.database();
  } catch (err) {
    console.error("Ошибка подключения к Firebase:", err);
    return null;
  }
}
