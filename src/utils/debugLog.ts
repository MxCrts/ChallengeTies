// src/utils/debugLog.ts
export const dlog = (...args: any[]) => {
  if (!__DEV__) return;
  // timestamp court
  const t = new Date().toISOString().slice(11, 19);
  console.log(`🧭[${t}]`, ...args);
};
