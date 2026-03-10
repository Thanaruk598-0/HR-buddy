export type TokenType = "employee" | "admin" | "messenger";

const TOKEN_KEYS: Record<TokenType, string> = {
  employee: "hrbuddy.employee.sessionToken",
  admin: "hrbuddy.admin.sessionToken",
  messenger: "hrbuddy.messenger.sessionToken",
};

const TOKEN_CHANGED_EVENT = "hrbuddy:auth-token-changed";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function resolveTokenStorage() {
  if (!canUseBrowserStorage()) {
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
  const storage = resolveTokenStorage();
  if (!storage) {
    return null;
  }

  return storage.getItem(TOKEN_KEYS[type]);
}

export function setAuthToken(type: TokenType, token: string) {
  const storage = resolveTokenStorage();
  if (!storage) {
    return;
  }

  storage.setItem(TOKEN_KEYS[type], token);
  emitTokenChanged(type);
}

export function clearAuthToken(type: TokenType) {
  const storage = resolveTokenStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(TOKEN_KEYS[type]);
  emitTokenChanged(type);
}
