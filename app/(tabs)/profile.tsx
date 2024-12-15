import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");

const ProfileScreen = () => {
  const navigation = useNavigation(); // Use the hook to access navigation
  const [userData, setUserData] = useState({
    name: "",
    bio: "",
    profileImage: "",
    challengesCompleted: 0,
    challengesOngoing: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const scrollY = useSharedValue(0);

  const sections = [
    {
      name: "User Info",
      icon: "person-outline",
      navigateTo: "profile/UserInfo",
    },
    {
      name: "User Stats",
      icon: "stats-chart-outline",
      navigateTo: "profile/UserStats",
    },
    {
      name: "Current Challenges",
      icon: "flag-outline",
      navigateTo: "profile/CurrentChallenges",
    },
    {
      name: "Saved Challenges",
      icon: "bookmark-outline",
      navigateTo: "profile/SavedChallenges",
    },
  ];

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("User not authenticated.");
      }

      const userId = currentUser.uid;
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setUserData({
          name: userData.displayName || "Anonymous",
          bio: userData.bio || "No bio available",
          profileImage: userData.profileImage || "",
          challengesCompleted: userData.challengesCompleted || 0,
          challengesOngoing: userData.challengesOngoing || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const renderSection = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(item.navigateTo as never)}
      style={styles.sectionBubble}
    >
      <Ionicons name={item.icon} size={40} color="#007bff" />
      <Text style={styles.sectionText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const headerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(Math.max(0, 1 - scrollY.value / 150), {
      duration: 300,
    }),
    transform: [
      {
        translateY: withTiming(scrollY.value < 150 ? 0 : -scrollY.value + 150, {
          duration: 300,
        }),
      },
    ],
  }));

  const onScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[null]} // Null item for header rendering
        renderItem={() => (
          <View>
            {/* Header */}
            <Animated.View style={[styles.header, headerStyle]}>
              <Image
                source={
                  userData.profileImage
                    ? { uri: userData.profileImage }
                    : require("../../assets/images/default-profile.jpg") // Placeholder image
                }
                style={styles.profileImage}
              />
              <Text style={styles.username}>{userData.name}</Text>
              <Text style={styles.bio}>{userData.bio}</Text>
            </Animated.View>

            {/* Sections */}
            <View style={styles.sectionsContainer}>
              <FlatList
                data={sections}
                renderItem={renderSection}
                keyExtractor={(item) => item.navigateTo}
                numColumns={2}
                columnWrapperStyle={styles.sectionRow}
              />
            </View>
          </View>
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.contentContainer}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  contentContainer: {
    paddingBottom: 60,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#007bff",
    paddingTop: width * 0.1,
    paddingBottom: width * 0.15,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#fff",
    marginBottom: 10,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  bio: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#f1f1f1",
    textAlign: "center",
    paddingHorizontal: 15,
  },
  sectionsContainer: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionBubble: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 10,
    backgroundColor: "#fff",
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 4,
  },
  sectionText: {
    marginTop: 10,
    fontSize: 14,
    color: "#007bff",
    fontWeight: "bold",
    textAlign: "center",
  },
  sectionRow: {
    justifyContent: "space-between",
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#007bff",
  },
});

export default ProfileScreen;
