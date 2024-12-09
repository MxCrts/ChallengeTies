declare module "react-native-progress/Bar" {
  import { Component } from "react";
  import { ViewStyle } from "react-native";

  export interface ProgressBarProps {
    progress?: number;
    color?: string;
    unfilledColor?: string;
    borderColor?: string;
    width?: number | null;
    height?: number;
    style?: ViewStyle;
    indeterminate?: boolean;
    animationType?: "spring" | "timing";
    borderRadius?: number;
  }

  export default class ProgressBar extends Component<ProgressBarProps> {}
}
