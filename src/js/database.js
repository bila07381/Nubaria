const DB_NAME = "nubaria";
const DB_VERSION = 1;

const STORES = [
  "ingresos",
  "gastosFijos",
  "pagos",
  "tarjetas",
  "creditos",
  "categorias",
  "configuracion"
];

export function openNubariaDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite almacenamiento local con IndexedDB."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
