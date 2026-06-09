"use client";

export interface Credentials {
  key: string;
  accountId: string;
}

export const saveCredentials = (key: string, accountId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("wv_key", key);
  localStorage.setItem("wv_account_id", accountId);
};

export const loadCredentials = (): Credentials | null => {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem("wv_key");
  const accountId = localStorage.getItem("wv_account_id");
  if (!key || !accountId) return null;
  return { key, accountId };
};

export const clearCredentials = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("wv_key");
  localStorage.removeItem("wv_account_id");
};
