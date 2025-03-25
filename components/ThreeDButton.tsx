import React, { useRef } from "react";
import {
  TouchableWithoutFeedback,
  Animated,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Composant Bouton 3D
const ThreeDButton = ({ onPress, iconName, title }) => {
  const animation = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 100,
      useNativeDriver: false, // on anime des marges, donc false
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 50,
      useNativeDriver: false,
    }).start(() => {
      if (onPress) onPress();
    });
  };

  // Interpolations pour l'effet de profondeur
  const heightStyle = {
    marginTop: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [-15, 0],
    }),
    paddingBottom: animation.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 0],
    }),
  };

  const innerRadius = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 16],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.button}>
        <View style={styles.outer}>
          <Animated.View style={[styles.height, heightStyle]}>
            <Animated.View
              style={[styles.inner, { borderRadius: innerRadius }]}
            >
              <LinearGradient
                colors={["#ed8f03", "#ed8f03"]}
                style={styles.buttonGrad}
              >
                <Ionicons
                  name={iconName}
                  size={35}
                  color="#FFF"
                  style={{ marginBottom: 2 }}
                />
                <Text style={styles.white}>{title}</Text>
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 90,
    width: 160,
  },
  outer: {
    flex: 1,
    padding: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 14,
  },
  height: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
  },
  inner: {
    height: "100%",
    backgroundColor: "red", // Couleur de base (sera recouverte par le gradient)
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGrad: {
    height: "100%",
    width: "100%",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  white: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 20,
  },
  whiteSmall: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});

export default ThreeDButton;
