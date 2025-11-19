import { useRef, useCallback } from "react";
import ViewShot from "react-native-view-shot";
import { captureCardToFile, shareImageFile } from "@/utils/ShareCard";

export function useShareCard() {
  const ref = useRef<React.ElementRef<typeof ViewShot>>(null);

  const waitForMountAndPaint = useCallback(async () => {
    // wait up to ~10 frames for ref to mount
    for (let i = 0; i < 10 && !ref.current; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    // give one extra macrotask so layout/styles/gradients are ready
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }, []);

  const share = useCallback(
    async (filename?: string, dialogTitle?: string) => {
      await waitForMountAndPaint();
      const path = await captureCardToFile(ref, filename);
      await shareImageFile(path, dialogTitle);
      return path;
    },
    [waitForMountAndPaint]
  );

  return { ref, share };
}
