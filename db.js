"use strict";

/*
  Single-project persistence. Unlike the original app, there is no
  multi-project "library" here — this whole tool holds exactly one
  in-progress building/site at a time, auto-saved to IndexedDB under a
  fixed key. Starting a "New" project overwrites it (with confirmation
  in the UI layer).
*/
const ProjectDB = (() => {
  const DB_NAME = "RoomMeasurementDB";
  const DB_VERSION = 1;
  const STORE = "project";
  const RECORD_KEY = "current";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return dbPromise;
  }

  function runRequest(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = fn(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  }

  async function load() {
    return runRequest("readonly", store => store.get(RECORD_KEY));
  }

  async function save(record) {
    const toStore = Object.assign({}, record, { updatedAt: Date.now() });
    return runRequest("readwrite", store => store.put(toStore, RECORD_KEY));
  }

  async function clear() {
    return runRequest("readwrite", store => store.delete(RECORD_KEY));
  }

  async function estimateUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        return await navigator.storage.estimate();
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function explainError(error) {
    const name = (error && error.name) || "";
    if (name === "QuotaExceededError") {
      return "This device is low on storage space for websites. Free up space (or remove other large files/photos) and try again.";
    }
    return (error && error.message) || String(error) || "Unknown error.";
  }

  return { load, save, clear, estimateUsage, explainError };
})();
