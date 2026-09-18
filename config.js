
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB45SyyG_GZvpoIvPZjLBceOEVrN8cxGCdA",
  authDomain: "forzes-video.firebaseapp.com",
  databaseURL: "https://forzes-video-default-rtdb.firebaseio.com",
  projectId: "forzes-video",
  storageBucket: "forzes-video.firebasestorage.app",
  messagingSenderId: "769774353953",
  appId: "1:769774353953:web:9d5161d861220b68342d60"
};

const SETTINGS = {
  sound: true,
  volume: 0.3,
  duration: 0, 
  maxOnScreen: 5,

  cooldown: 60,
  maxNick: 40,
  maxMessage: 500
};
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
