// components/PressableScale.tsx
import React, { useCallback } from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native";

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PressableScale: React.FC<Props> = ({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (to: number) => {
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        friction: 6,
        tension: 120,
      }).start();
    },
    [scale]
  );

  return (
    <AnimatedPressable
      {...rest}
      style={[
        style,
        {
          transform: [{ scale }],
        },
      ]}
      android_ripple={{ color: "rgba(255,255,255,0.12)", borderless: false }}
      onPressIn={(e) => {
        animateTo(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        rest.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
};

export default PressableScale;
