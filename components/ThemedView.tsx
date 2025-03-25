import { View, type ViewProps } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  // Ajout d'un fallback explicite au cas où useThemeColor renverrait undefined
  const backgroundColor =
    useThemeColor({ light: lightColor, dark: darkColor }, "background") ||
    "#fff";
  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
