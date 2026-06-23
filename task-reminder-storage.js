(function () {
  const DB_NAME = "HugeToolsTaskReminder";
  const DB_VERSION = 1;
  const STORE = "tasks";
  const SETTINGS_KEY = "hugetools.taskReminder.settings";

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持 IndexedDB"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("role", "role", { unique: false });
          store.createIndex("enabled", "enabled", { unique: false });
          store.createIndex("nextDueAt", "nextDueAt", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function withStore(mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      result = callback(store);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function listTasks() {
    return withStore("readonly", (store) => requestToPromise(store.getAll()));
  }

  async function getTask(id) {
    return withStore("readonly", (store) => requestToPromise(store.get(id)));
  }

  async function saveTask(task) {
    return withStore("readwrite", (store) => requestToPromise(store.put(task)));
  }

  async function deleteTask(id) {
    return withStore("readwrite", (store) => requestToPromise(store.delete(id)));
  }

  async function bulkSave(tasks) {
    return withStore("readwrite", (store) => {
      tasks.forEach((task) => store.put(task));
      return true;
    });
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSettings(nextSettings) {
    const settings = { ...readSettings(), ...nextSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }

  window.HugeToolsTaskStorage = {
    listTasks,
    getTask,
    saveTask,
    deleteTask,
    bulkSave,
    readSettings,
    saveSettings
  };
})();
