import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import { TrophyProvider } from "../../context/TrophyContext";
import { useEffect, useState } from "react";
import { auth, db } from "../../constants/firebase-config";
import { doc, getDoc } from "firebase/firestore";

const TabsLayout = () => {
  const [hasUnclaimedAchievements, setHasUnclaimedAchievements] =
    useState(false);

  useEffect(() => {
    const fetchUserAchievements = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const newAchievements = userData.newAchievements || [];

        // ✅ Vérifie si des succès sont à réclamer
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
            height: 70,
            borderTopLeftRadius: 15,
            borderTopRightRadius: 15,
            elevation: 10,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "bold",
          },
          tabBarIconStyle: {
            marginBottom: -5,
          },
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
              <View>
                <Ionicons name="person" size={size} color={color} />
                {hasUnclaimedAchievements && (
                  <View
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -5,
                      backgroundColor: "red",
                      width: 12,
                      height: 12,
                      borderRadius: 6,
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
                  backgroundColor: focused ? "#1ABC00" : "#E3F4CA",
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -20,
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
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
