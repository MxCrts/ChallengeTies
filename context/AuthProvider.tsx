import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth } from "../constants/firebase-config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAndSaveUserLocation } from "../services/locationService";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  checkingAuth: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log("✅ Utilisateur connecté:", firebaseUser.email);
        setUser(firebaseUser);

        try {
          await AsyncStorage.setItem("user", JSON.stringify(firebaseUser));

          // ✅ Récupération & Sauvegarde de la localisation (après login ou register)
          await fetchAndSaveUserLocation();
        } catch (error) {
          console.error(
            "⚠️ Erreur lors de la sauvegarde de l'utilisateur:",
            error
          );
        }
      } else {
        console.log("🔴 Aucun utilisateur connecté. Redirection vers login...");
        setUser(null);
        try {
          await AsyncStorage.removeItem("user");
        } catch (error) {
          console.error("⚠️ Erreur lors du retrait de l'utilisateur:", error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fonction de déconnexion
  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem("user");
      setUser(null);
    } catch (error) {
      console.error("❌ Erreur lors de la déconnexion:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, checkingAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
