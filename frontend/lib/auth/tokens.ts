export type TokenType = "employee" | "admin" | "messenger";

const TOKEN_KEYS: Record<TokenType, string> = {
  employee: "hrbuddy.employee.sessionToken",
  admin: "hrbuddy.admin.sessionToken",
  messenger: "hrbuddy.messenger.sessionToken",
};

const TOKEN_CHANGED_EVENT = "hrbuddy:auth-token-changed";

type TokenStorageMode = "memory" | "session";

const configuredStorageMode =
  (process.env.NEXT_PUBLIC_AUTH_TOKEN_STORAGE?.toLowerCase() as TokenStorageMode | undefined) ?? "memory";

const tokenCache: Partial<Record<TokenType, string>> = {};

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getStorageMode(): TokenStorageMode {
  return configuredStorageMode === "session" ? "session" : "memory";
}

function resolveTokenStorage() {
  if (!canUseBrowserStorage() || getStorageMode() !== "session") {
    return null;
  }

  return window.sessionStorage;
}

function emitTokenChanged(type: TokenType) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TOKEN_CHANGED_EVENT, {
      detail: { type },
    }),
  );
}

export function getTokenChangedEventName() {
  return TOKEN_CHANGED_EVENT;
}

export function getTokenStorageKey(type: TokenType) {
  return TOKEN_KEYS[type];
}

export function getAuthToken(type: TokenType): string | null {
  const fromCache = tokenCache[type];
  if (fromCache) {
    return fromCache;
  }

  const storage = resolveTokenStorage();
  if (!storage) {
    return null;
  }

  const persisted = storage.getItem(TOKEN_KEYS[type]);
  if (persisted) {
    tokenCache[type] = persisted;
  }

  return persisted;
}

export function setAuthToken(type: TokenType, token: string) {
  tokenCache[type] = token;

  const storage = resolveTokenStorage();
  if (storage) {
    storage.setItem(TOKEN_KEYS[type], token);
  }

  emitTokenChanged(type);
}

export function clearAuthToken(type: TokenType) {
  delete tokenCache[type];

  const storage = resolveTokenStorage();
  if (storage) {
    storage.removeItem(TOKEN_KEYS[type]);
  }

  emitTokenChanged(type);
}
