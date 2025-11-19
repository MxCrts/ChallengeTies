// components/BannerSlot.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { View, useWindowDimensions, Animated, LayoutChangeEvent } from "react-native";
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { adUnitIds } from "@/constants/admob";
import { Keyboard } from "react-native";


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

  // Flags globaux éventuels
  const npa = (globalThis as any).__NPA__ === true;
  const canRequestAds = (globalThis as any).__CAN_REQUEST_ADS__ !== false;

  // UnitId mémoïsé
  const unitId = useMemo(
    () => (__DEV__ ? TestIds.BANNER : adUnitIds.banner),
    [adUnitIds.banner]
  );

  // Anim d’apparition / disparition
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  // Sécurité unmount (évite setState après unmount si l’ad répond tard)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
   const sh = Keyboard.addListener("keyboardDidShow", () => setKb(true));
   const hh = Keyboard.addListener("keyboardDidHide", () => setKb(false));
   return () => { sh.remove(); hh.remove(); };
 }, []);

  // Pas d’ads si désactivées globalement
  if (!canRequestAds || kb) return null;

  const handleLayout = (e: LayoutChangeEvent) => {
    if (!visible) return;
    const measured = Math.max(50, Math.round(e.nativeEvent.layout.height));
    if (measured !== lastHeightRef.current) {
      lastHeightRef.current = measured;
      onHeight?.(measured);
    }
  };

  return (
    <Animated.View
      style={{
        width: "100%",
        alignItems: "center",
        transform: [
          {
            translateY: slide.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0], // petit slide-in quand ça apparaît
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
          // Si docked (fixe en bas), on évite toute couleur parasite
          backgroundColor: "transparent",
        }}
        pointerEvents="box-none"
      >
        <BannerAd
          unitId={unitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            // Prend en charge le mode NPA (non-personnalisé)
            requestNonPersonalizedAdsOnly: npa ? true : false,
            // Certaines intégrations exigent aussi l’extra 'npa'
            networkExtras: npa ? { npa: "1" } : undefined,
          }}
          onAdLoaded={() => {
            if (!isMountedRef.current) return;
            setVisible(true);
            // Première estimation (au cas où onLayout tarde)
            if (lastHeightRef.current === 0) {
              lastHeightRef.current = 50;
              onHeight?.(50);
            }
            __DEV__ &&
              console.log(
                "📢 Banner loaded",
                { unitId, docked, width, npa }
              );
          }}
          onAdFailedToLoad={(e) => {
            if (!isMountedRef.current) return;
            __DEV__ && console.log("🛑 Banner ERROR:", e);
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
