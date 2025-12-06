// components/BannerSlot.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  useWindowDimensions,
  Animated,
  LayoutChangeEvent,
  Keyboard,
} from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";

type Props = {
  /** Appelé quand la bannière est affichée et mesurée (hauteur réelle en px) */
  onHeight?: (h: number) => void;
  /** Par défaut false : inline. Mettre true quand utilisée en bas absolu */
  docked?: boolean;
};

const BannerSlot: React.FC<Props> = ({ onHeight, docked = false }) => {
  const [visible, setVisible] = useState(false);
  const [kb, setKb] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const lastHeightRef = useRef<number>(0);
  const { width } = useWindowDimensions();

  // Flags globaux éventuels (posés par ConsentGate)
  const npa = (globalThis as any).__NPA__ === true;
  const rawCanRequest = (globalThis as any).__CAN_REQUEST_ADS__;
  const canRequestAds = rawCanRequest !== false;

  // UnitId mémoïsé — logique test/prod centralisée dans adUnitIds
  const unitId = useMemo(() => adUnitIds.banner, []);

  // Anim d’apparition / disparition
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  // Sécurité unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Écoute clavier
  useEffect(() => {
    const sh = Keyboard.addListener("keyboardDidShow", () => setKb(true));
    const hh = Keyboard.addListener("keyboardDidHide", () => setKb(false));
    return () => {
      sh.remove();
      hh.remove();
    };
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    if (!visible) return;
    const measured = Math.max(50, Math.round(e.nativeEvent.layout.height));
    if (measured !== lastHeightRef.current) {
      lastHeightRef.current = measured;
      onHeight?.(measured);
    }
  };

  // 👉 Décision d’affichage
  const hideForKeyboard = kb && docked;
  const shouldHide = !canRequestAds || hideForKeyboard;

  // ✅ Quand on doit cacher la bannière (no ads / clavier docked),
  // on remet proprement la hauteur à 0 **après** le render via un effet.
  useEffect(() => {
    if (shouldHide && lastHeightRef.current !== 0) {
      lastHeightRef.current = 0;
      onHeight?.(0);
    }
  }, [shouldHide, onHeight]);

  if (shouldHide) {
    return <View style={{ width: "100%", height: 0 }} pointerEvents="none" />;
  }

  return (
    <Animated.View
      style={{
        width: "100%",
        alignItems: "center",
        transform: [
          {
            translateY: slide.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0],
            }),
          },
        ],
      }}
      pointerEvents="box-none"
      onLayout={handleLayout}
    >
      <View
        style={{
          width,
          alignItems: "center",
          backgroundColor: "transparent",
        }}
        pointerEvents="box-none"
      >
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: npa ? true : false,
            networkExtras: npa ? { npa: "1" } : undefined,
          }}
          onAdLoaded={() => {
            if (!isMountedRef.current) return;
            setVisible(true);

            if (lastHeightRef.current === 0) {
              lastHeightRef.current = 50;
              onHeight?.(50);
            }

            console.log("📢 [BannerSlot] Banner loaded", {
              unitId,
              docked,
              width,
              npa,
            });
          }}
          onAdFailedToLoad={(e) => {
            if (!isMountedRef.current) return;

            console.log("🛑 [BannerSlot] Banner ERROR:", e);

            setVisible(false);
            if (lastHeightRef.current !== 0) {
              lastHeightRef.current = 0;
              onHeight?.(0);
            }
          }}
        />
      </View>
    </Animated.View>
  );
};

export default BannerSlot;
