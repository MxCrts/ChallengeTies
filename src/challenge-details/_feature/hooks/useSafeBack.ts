import { useCallback } from "react";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

type RouterLike = {
  replace: (path: any) => void;
  back: () => void;
  canGoBack?: () => boolean;
};

type Args = {
  router: RouterLike;
  isDeeplink: () => boolean;
  fallbackRoute?: string; // défaut "/"
};

export function useSafeBack({ router, isDeeplink, fallbackRoute = "/" }: Args) {
  const handleSafeBack = useCallback(() => {
    // ✅ Deeplink: pas de stack fiable => home
    if (isDeeplink()) {
      router.replace(fallbackRoute as any);
      return true;
    }

    // @ts-ignore (expo-router)
    if (router.canGoBack?.()) {
      router.back();
      return true;
    }

    router.replace(fallbackRoute as any);
    return true;
  }, [router, isDeeplink, fallbackRoute]);

  // ✅ Hardware back Android
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleSafeBack);
      return () => sub.remove();
    }, [handleSafeBack])
  );

  return { handleSafeBack };
}
