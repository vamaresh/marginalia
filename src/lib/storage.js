// Drop-in replacement for the Claude-artifact "window.storage" API,
// backed by the browser's real localStorage so it works on any deployed site.

const KEY = "marginalia:data";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export const storage = {
  async get(key) {
    const data = readAll();
    if (!(key in data)) return null;
    return { key, value: data[key], shared: false };
  },
  async set(key, value) {
    const data = readAll();
    data[key] = value;
    writeAll(data);
    return { key, value, shared: false };
  },
  async delete(key) {
    const data = readAll();
    const existed = key in data;
    delete data[key];
    writeAll(data);
    return { key, deleted: existed, shared: false };
  },
  async list(prefix = "") {
    const data = readAll();
    const keys = Object.keys(data).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
