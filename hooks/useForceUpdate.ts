// src/hooks/useForceUpdate.ts
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";
import * as Application from "expo-application";

const compareVersions = (a: string, b: string) => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
};

export type UpdateStatus =
  | { type: "ok" }
  | { type: "force"; storeUrl: string }
  | { type: "nudge"; storeUrl: string };

export function useForceUpdate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "appVersion"));
        if (!snap.exists() || cancelled) return;

        const data = snap.data() as any;
        const current = Application.nativeApplicationVersion ?? "0.0.0";
        const min = data.minVersion ?? "0.0.0";
        const storeUrl =
          Platform.OS === "ios" ? data.storeUrlIos : data.storeUrlAndroid;

        if (compareVersions(current, min) < 0 || data.forceUpdate === true) {
          setStatus({ type: "force", storeUrl });
        } else if (
          data.latestVersion &&
          compareVersions(current, data.latestVersion) < 0
        ) {
          setStatus({ type: "nudge", storeUrl });
        } else {
          setStatus({ type: "ok" });
        }
      } catch {
        setStatus({ type: "ok" }); // fail silencieux → on laisse passer
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  return status;
}