// A small user "database" stored in the browser with IndexedDB.
// It is created and filled with sample users the first time the page loads.
const DB_NAME = "login_demo";
const STORE = "users";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "login_name" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const r = store[method](...args);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// Salted SHA-256 hash, so passwords are not stored as plain text
async function hash(password, salt) {
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function newSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

// Add the sample users once
async function seed(db) {
  const count = await request(db.transaction(STORE).objectStore(STORE), "count");
  if (count > 0) return;
  const samples = { admin: "admin123", student: "pass@123" };
  const rows = [];
  for (const [login_name, pw] of Object.entries(samples)) {
    const salt = newSalt();
    rows.push({ login_name, salt, password_hash: await hash(pw, salt) });
  }
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  rows.forEach(r => store.put(r));
}

// Returns true when the login name exists and the password matches
async function validateUser(login, password) {
  if (!window.crypto || !crypto.subtle) throw new Error("Open this page over https:// or http://localhost.");
  const db = await openDB();
  await seed(db);
  const row = await request(db.transaction(STORE).objectStore(STORE), "get", login);
  return !!row && (await hash(password, row.salt)) === row.password_hash;
}
