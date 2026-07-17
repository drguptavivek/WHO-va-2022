import type { WhoVaDraft, WhoVaDraftStore } from "./types.js";

export const WHO_VA_DRAFT_KEY_PREFIX = "who-va-2022:draft:";

export interface DraftKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(bytes);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return bytes;
}

export function createDraftId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = randomBytes();
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createLocalStorageDraftStore(storage?: DraftKeyValueStorage): WhoVaDraftStore {
  const resolveStorage = () => {
    const resolved = storage ?? globalThis.localStorage;
    if (!resolved) throw new Error("Local storage is unavailable; provide a WhoVaDraftStore adapter");
    return resolved;
  };
  return {
    save(draft) {
      resolveStorage().setItem(`${WHO_VA_DRAFT_KEY_PREFIX}${draft.id}`, JSON.stringify(draft));
    },
    load(id) {
      const serialized = resolveStorage().getItem(`${WHO_VA_DRAFT_KEY_PREFIX}${id}`);
      return serialized ? JSON.parse(serialized) as WhoVaDraft : undefined;
    },
    remove(id) {
      resolveStorage().removeItem(`${WHO_VA_DRAFT_KEY_PREFIX}${id}`);
    }
  };
}
