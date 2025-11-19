import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import ViewShot, { captureRef } from "react-native-view-shot";

export async function captureCardToFile(
  ref: React.RefObject<ViewShot>,
  filename: string = `ct-card-${Date.now()}.png`
) {
  if (!ref.current) throw new Error("ViewShot ref not attached");
  // Utilise captureRef pour passer les options (PNG, qualité max, fichier temporaire)
  const uri = await captureRef(ref.current!, {
  format: "png",
  quality: 1,
  result: "tmpfile",
   width: 1080,
   height: Math.round(1080 * 1.2),
});
  // On force le chemin cache + extension propre
  const target = `${FileSystem.cacheDirectory}${filename}`;
  if (uri && uri !== target) {
    await FileSystem.copyAsync({ from: uri, to: target });
  }
  return target;
}

export async function shareImageFile(localUri: string, dialogTitle?: string) {
  // iOS/Android OK via expo-sharing
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    // Fallback éventuel : Share API RN (texte + url), mais expo-sharing est mieux pour image locale
    throw new Error("Sharing not available on this device");
  }
  await Sharing.shareAsync(localUri, {
    mimeType: "image/png",
    dialogTitle: dialogTitle ?? "Partager avec…",
    UTI: "public.png",
  });
}
