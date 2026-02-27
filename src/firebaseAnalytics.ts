import analytics from "@react-native-firebase/analytics";

export async function faLogEvent(
  name: string,
  params: Record<string, any> = {}
) {
  try {
    await analytics().logEvent(name, params);
  } catch (e) {
    console.log("[FA] logEvent error:", e);
  }
}

export async function faSetUserId(uid: string | null) {
  try {
    await analytics().setUserId(uid);
  } catch {}
}