(function () {
  const DB_NAME = "HugeToolsTaskReminder";
  const DB_VERSION = 1;
  const STORE = "tasks";
  const SETTINGS_KEY = "hugetools.taskReminder.settings";
  const OPEN_TIMEOUT_MS = 3000;

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    const opening = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("当前浏览器不支持 IndexedDB"));
        return;
      }
      let settled = false;
      let timer;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (error) { fail(error); return; }
      timer = setTimeout(() => fail(new Error("任务存储读取超时，请稍后重试；原记录未变")), OPEN_TIMEOUT_MS);
      request.onupgradeneeded = () => {
        if (settled) { request.transaction?.abort(); return; }
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("role", "role", { unique: false });
          store.createIndex("enabled", "enabled", { unique: false });
          store.createIndex("nextDueAt", "nextDueAt", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // A timed-out open request cannot be cancelled. Close its eventual handle
        // so it does not block a newer attempt or a database version change.
        if (settled) { db.close(); return; }
        settled = true;
        clearTimeout(timer);
        const invalidate = () => { if (dbPromise === opening) dbPromise = null; };
        db.onversionchange = () => { db.close(); invalidate(); };
        db.onclose = invalidate;
        resolve(db);
      };
      request.onerror = () => fail(request.error || new Error("任务存储无法打开，请稍后重试"));
      request.onblocked = () => fail(new Error("任务存储被其他页面占用，请关闭相关页面后重试；原记录未变"));
    });
    dbPromise = opening;
    opening.catch(() => { if (dbPromise === opening) dbPromise = null; });
    return opening;
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

  async function replaceAll(tasks) {
    return withStore("readwrite", (store) => {
      store.clear();
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
    replaceAll,
    readSettings,
    saveSettings
  };
})();
