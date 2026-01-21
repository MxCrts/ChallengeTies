import { getFunctions, httpsCallable, Functions } from "firebase/functions";
import { app } from "@/constants/firebase-config";
// optionnel en dev
// import { connectFunctionsEmulator } from "firebase/functions";

const REGION = "europe-west1"; // <-- mets la région réelle de tes functions
const functions: Functions = getFunctions(app, REGION);

// if (__DEV__) {
//   connectFunctionsEmulator(functions, "127.0.0.1", 5001);
// }

export type DuoNudgeParams = {
  type: "auto" | "manual";
  challengeId: string;
  selectedDays: number;
  partnerId: string;
  uniqueKey?: string; // legacy optionnel
};

export type SendDuoNudgeResult = {
  ok: boolean;
  deduped?: boolean;
  reason?: string;
};

const sendDuoNudgeCallable = httpsCallable<DuoNudgeParams, SendDuoNudgeResult>(
  functions,
  "sendDuoNudge"
);

export async function sendDuoNudge(params: DuoNudgeParams): Promise<SendDuoNudgeResult> {
  try {
    const res = await sendDuoNudgeCallable(params);
    return res.data ?? { ok: false, reason: "no_data" };
  } catch (e: any) {
    // Important: ne casse jamais le flow "markToday"
    return { ok: false, reason: e?.message ?? "call_failed" };
  }
}
