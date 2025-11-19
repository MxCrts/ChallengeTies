// components/SpotlightOverlay.tsx
import React, { useMemo } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Svg, { Rect, Defs, Mask } from "react-native-svg";

type RectLike = { x: number; y: number; width: number; height: number };

type Props = {
  target?: RectLike;
  radius?: number;
  padding?: number;
  dimOpacity?: number;     // 0..1 (ex: 0.85 bien lisible)
  strokeWidth?: number;    // ring fin autour du trou
  onPress?: () => void;    // avancer étape
};

const SpotlightOverlay: React.FC<Props> = ({
  target,
  radius = 14,
  padding = 10,
  dimOpacity = 0.85,
  strokeWidth = 2,
  onPress,
}) => {
  const hole = useMemo(() => {
    if (!target) return null;
    const x = Math.max(0, target.x - padding);
    const y = Math.max(0, target.y - padding);
    const w = Math.max(0, target.width + padding * 2);
    const h = Math.max(0, target.height + padding * 2);
    return { x, y, w, h, r: radius };
  }, [target, padding, radius]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Capture tous les taps pour avancer l’étape sans cliquer “à travers” */}
      <Pressable onPress={onPress} style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="holeMask">
              {/* tout visible */}
              <Rect x="0" y="0" width="100%" height="100%" fill="#fff" />
              {/* la zone à “évider” → le trou */}
              {hole && (
                <Rect
                  x={hole.x}
                  y={hole.y}
                  width={hole.w}
                  height={hole.h}
                  rx={hole.r}
                  ry={hole.r}
                  fill="#000"
                />
              )}
            </Mask>
          </Defs>

          {/* voile sombre avec masque inversé */}
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`rgba(0,0,0,${dimOpacity})`}
            mask="url(#holeMask)"
          />

          {/* ring blanc pour détacher visuellement la cible */}
          {hole && (
            <Rect
              x={hole.x}
              y={hole.y}
              width={hole.w}
              height={hole.h}
              rx={hole.r}
              ry={hole.r}
              stroke="rgba(255,255,255,0.95)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
          )}
        </Svg>
      </Pressable>
    </View>
  );
};

export default SpotlightOverlay;
