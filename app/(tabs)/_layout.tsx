import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { TrophyProvider } from "../../context/TrophyContext";
import { useEffect, useState } from "react";
import { auth, db } from "../../constants/firebase-config";
import { doc, getDoc } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabsLayout = () => {
  const [hasUnclaimedAchievements, setHasUnclaimedAchievements] =
    useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchUserAchievements = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const newAchievements = userData.newAchievements || [];
        setHasUnclaimedAchievements(newAchievements.length > 0);
      }
    };

    fetchUserAchievements();
  }, []);

  return (
    <TrophyProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            elevation: 10,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
            marginBottom: 5,
          },
          tabBarIconStyle: {
            marginBottom: -5,
          },
          tabBarActiveTintColor: "#ED8F03",
          tabBarInactiveTintColor: "#A0AEC0",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            tabBarLabel: "Profile",
            tabBarIcon: ({ color, size }) => (
              <View style={{ position: "relative" }}>
                <Ionicons name="person" size={size} color={color} />
                {hasUnclaimedAchievements && (
                  <View
                    style={{
                      position: "absolute",
                      top: -3,
                      right: -3,
                      backgroundColor: "red",
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      borderWidth: 1,
                      borderColor: "#FFF",
                    }}
                  />
                )}
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="focus"
          options={{
            tabBarLabel: "",
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  backgroundColor: focused ? "#ED8F03" : "#FFE8D6",
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -20,
                  shadowColor: "#000",
                  shadowOpacity: 0.3,
                  shadowOffset: { width: 0, height: 3 },
                  shadowRadius: 5,
                  elevation: 5,
                }}
              >
                <Ionicons name="flame" size={32} color={"#FFF"} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="explore"
          options={{
            tabBarLabel: "Explore",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass" size={size} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="settings"
          options={{
            tabBarLabel: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </TrophyProvider>
  );
};

export default TabsLayout;
