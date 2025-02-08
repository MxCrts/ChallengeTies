import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PaperProvider } from "react-native-paper";
import { auth } from "../constants/firebase-config";
import { onAuthStateChanged, User } from "firebase/auth";

const RootLayout = () => {
  const router = useRouter();
  const [isAppReady, setIsAppReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);

  // ✅ Vérification de l'authentification Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Initialisation de l'application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await AsyncStorage.getItem("hasSeenOnboarding");
      } catch (error) {
        console.error("❌ Erreur lors de l'initialisation:", error);
      } finally {
        setIsAppReady(true);
      }
    };

    initializeApp();
  }, []);

  // ✅ S'assurer que tout est prêt avant de rediriger
  useEffect(() => {
    if (authChecked && isAppReady && !navigationReady) {
      setNavigationReady(true);
    }
  }, [authChecked, isAppReady, navigationReady]);

  // ✅ Redirection quand tout est prêt
  useEffect(() => {
    if (navigationReady) {
      if (!user) {
        router.replace("/login");
      }
    }
  }, [navigationReady, user]);

  // ✅ Toujours afficher un écran de chargement si l'initialisation n'est pas complète
  if (!navigationReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFF",
    textAlign: "center",
  },
});
