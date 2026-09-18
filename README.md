# 🎥 Сайт «Отправь видео на обзор» — Forzes Stream

Зритель заходит на сайт, пишет описание и кидает ссылку на своё YouTube-видео, нажимает «Отправить». А ты во время стрима видишь в OBS всплывающее уведомление (превью + ник + описание) со звуком.

| Файл | Что это | Для кого |
|---|---|---|
| `index.html` | Форма отправки видео | зрители |
| `widget.html` | Уведомления + звук в OBS | ты |
| `dashboard.html` | Панель со всеми заявками (можно удалять спам) | ты |
| `config.js` | Настройки и конфиг базы | ты |

## Как это работает

```
Зритель → форма (GitHub Pages) → Firebase (облачная база, бесплатно)
                                      ↓ слушает в реальном времени
                              OBS widget.html → уведомление + звук
```

**Почему не нужен сервер на твоём компе.** У nutty.gg виджеты работают по адресу localhost, потому что их программа крутится у тебя на ПК и раздаёт данные виджетам. Но принять заявку от зрителя localhost не может — твой комп недоступен из интернета, а держать его включённым и «проброшенным» наружу — лишние проблемы. Поэтому форму принимает бесплатная облачная база **Firebase Realtime Database**, а виджет в OBS слушает её напрямую. Твой комп может быть вообще выключен — заявки копятся, уведомления придут, когда ты выйдешь в эфир.

## Шаг 1. Создаём базу Firebase (5 минут)

1. Открой <https://console.firebase.google.com> и войди в свой Google-аккаунт.
2. **Create a project (Создать проект)** → имя, например `forzes-video` → Google Analytics можно отключить → **Create**.
3. В меню слева: **Build → Realtime Database → Create Database**.
4. Локация — любая (например `europe-west1`) → **Start in test mode** → **Enable**.
5. Сверху на странице базы скопируй адрес вида
   `https://forzes-video-default-rtdb.firebaseio.com`
   (для Европы: `https://...-default-rtdb.europe-west1.firebasedatabase.app`) —
   это **databaseURL**, он понадобится в шаге 2.
6. Шестерёнка **Project settings → вкладка General → внизу Your apps → иконка `</>` (Web)**.
7. Имя приложения: `forzes-site` → **Register app** → Firebase Hosting НЕ подключай → промотай вниз → **Continue to console**.
8. На экране появится блок `const firebaseConfig = {...}` — скопируй из него значения `apiKey`, `authDomain`, `projectId`, `appId`.

## Шаг 2. Вставляем конфиг в config.js

Открой `config.js` и замени слова `ВСТАВЬ_СЮДА_...` своими значениями:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...твоё...",
  authDomain: "forzes-video.firebaseapp.com",
  databaseURL: "https://forzes-video-default-rtdb.firebaseio.com",
  projectId: "forzes-video",
  storageBucket: "",
  messagingSenderId: "",
  appId: "1:1234567890:web:abcdef..."
};
```

⚠️ **databaseURL обязательно проверь** — в новом консоли Firebase его в блоке может не быть. Впиши адрес из шага 1.5 вручную. Без него уведомления работать не будут.

## Шаг 3. Заливаем сайт на GitHub Pages

1. Зайди на <https://github.com> (зарегистрируйся, если нет аккаунта).
2. **New repository** → имя, например `forzes-video` → **Public** → **Create**.
3. **Add file → Upload files** → перетащи ВСЕ файлы из этой папки → **Commit changes**.
4. **Settings → Pages** (слева) → **Source: Deploy from a branch** → Branch: **main**, папка **/ (root)** → **Save**.
5. Через 1–2 минуты сайт появится по адресу
   `https://ТВОЙ_НИК.github.io/forzes-video/`

**Эту ссылку и даёшь зрителям в стриме/описании канала:**

```
https://ТВОЙ_НИК.github.io/forzes-video/
```

## Шаг 4. Добавляем уведомления в OBS

1. **Sources → «+» → Browser** → имя любое, например `Видео на обзор`.
2. **URL:** `https://ТВОЙ_НИК.github.io/forzes-video/widget.html`
3. **Width: 480, Height: 1000** (карточка сама встанет в правый верхний угол источника).
4. Обязательно включи галочку **Control audio via OBS** — иначе не будет звука.
5. Нажми OK. Источник можно растянуть/поставить где угодно — фон у него прозрачный.
6. НЕ включай «Shutdown source when not visible».

Полезно: правый клик по источнику → **Interact** — можно кликнуть по кнопке «Открыть видео» прямо из OBS (ссылка откроется в браузере).

## Шаг 5. Проверяем

1. Открой в браузере форму: `https://ТВОЙ_НИК.github.io/forzes-video/`
2. Отправь тестовую заявку (ник, ссылку на любое YouTube-видео, описание).
3. Через 1–2 секунды в OBS выскочит уведомление и прозвучит звук. 🎉
4. Панель всех заявок: `https://ТВОЙ_НИК.github.io/forzes-video/dashboard.html`

Быстрый тест без заявки: добавь во временный browser source URL
`.../widget.html?test=1` — появится тестовое уведомление (потом источник удали).

## Шаг 6 (сильно советую). Правила безопасности

Тестовый режим базы действует **30 дней**, потом запись запретится. Чтобы сайт работал всегда и был защищён от мусора:

1. Firebase → **Realtime Database → вкладка Rules**.
2. Замени содержимое на это и нажми **Publish**:

```json
{
  "rules": {
    "submissions": {
      ".read": true,
      "$id": {
        ".write": true,
        ".validate": "newData.hasChildren(['nick','message','link','ts'])",
        "nick":    { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40" },
        "message": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 500" },
        "link":    { ".validate": "newData.isString() && newData.val().length <= 300" },
        "vid":     { ".validate": "newData.isString() && newData.val().length <= 16" },
        "ts":      { ".validate": "newData.isNumber() && newData.val() <= now + 300000" },
        "$other":  { ".validate": false }
      }
    }
  }
}
```

Это разрешает всем читать заявки и создавать новые (нужна форма), но режет слишком длинные/битые данные.

## Настройки

В `config.js` блок `SETTINGS`:

| Параметр | Что делает |
|---|---|
| `sound` | звук уведомления вкл/выкл |
| `volume` | громкость звука 0.0–1.0 |
| `duration` | сколько секунд висит карточка |
| `maxOnScreen` | максимум карточек одновременно |
| `cooldown` | пауза между отправками у зрителя (сек) |
| `maxNick` / `maxMessage` | лимиты длины полей |

Параметры в адресе виджета (важнее настроек из config.js):

```
widget.html?test=1      — тестовое уведомление
widget.html?sound=0     — без звука
widget.html?dur=20      — карточка на 20 секунд
widget.html?vol=0.3     — громкость 30%
```

## Решение проблем

| Проблема | Решение |
|---|---|
| Нет звука в OBS | В свойствах источника включи «Control audio via OBS» и подними ползунок в Audio Mixer. Если не помогло: правый клик по источнику → Refresh cache; либо Interact → один клик по виджету (после первого клика звук начинает работать) |
| Уведомлений нет | Открой dashboard.html — заявки видны? Если да, правый клик по источнику в OBS → Refresh cache. Проверь, что в config.js вставлен databaseURL |
| На страницах жёлтое предупреждение / ничего не работает | config.js не заполнен — шаги 1–2 |
| Красная ошибка «permission denied» | Действует 30 дней тестовый режим или правила режут доступ — вставь правила из шага 6 |
| Хочу поменять дизайн | Все стили внутри `<style>` в html-файлах, тексты — прямо в разметке |
| Изменил файлы, а на сайте старое | Обнови файлы на GitHub (Edit/Upload), в OBS: правый клик по источнику → Refresh cache |

## Лимиты бесплатного тарифа Firebase

- **100 одновременных подключений** — виджет в OBS занимает одно; запас огромный.
- **10 ГБ трафика/мес и 1 ГБ хранения** — заявки крошечные, ты не упрёшься.
- Тариф называется **Spark (без карты)**. Realtime Database на нём бесплатен.

## Как обновлять сайт

На GitHub открой нужный файл → карандаш (Edit) → вставь новое → **Commit changes** (или снова Upload files с заменой). После правок обнови источник в OBS: правый клик → **Refresh cache of current page**.

---
Сделано для канала **Forzes Stream** 💜 Удачных стримов!

