import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";

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
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
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
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [myChallenges, setMyChallenges] = useState<
    {
      id: string;
      title: string;
      category: string;
      description: string;
      imageUrl?: string | null;
    }[]
  >([]);

  const [loadingChallenges, setLoadingChallenges] = useState(false);

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

  const fetchMyChallenges = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error("User not authenticated.");
      }

      const challengesRef = collection(db, "challenges");
      const q = query(challengesRef, where("creatorId", "==", userId));
      const querySnapshot = await getDocs(q);

      const challenges = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title || "Untitled Challenge",
        category: doc.data().category || "Uncategorized",
        description: doc.data().description || "No description available",
        imageUrl: doc.data().imageUrl || null,
      }));

      setMyChallenges(challenges); // Set the formatted challenges
    } catch (error) {
      console.error("Error fetching my challenges:", error);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchMyChallenges();
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

  const renderChallenge = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.challengeCard}
      onPress={() =>
        router.push({
          pathname: "/challenge-details/[id]",
          params: {
            id: item.id, // Challenge ID (required)
            title: item.title, // Optional
            category: item.category, // Optional
            description: item.description, // Optional
          },
        })
      }
    >
      <Image
        source={
          item.imageUrl
            ? { uri: item.imageUrl }
            : require("../../public/images/default-challenge.webp")
        }
        style={styles.challengeImage}
        resizeMode="cover"
      />
      <Text style={styles.challengeTitle}>{item.title}</Text>
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

            {/* My Challenges Section */}
            <View style={styles.myChallengesContainer}>
              <Text style={styles.myChallengesTitle}>My Challenges</Text>
              {loadingChallenges ? (
                <ActivityIndicator size="small" color="#007bff" />
              ) : myChallenges.length > 0 ? (
                <FlatList
                  data={myChallenges}
                  renderItem={renderChallenge}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.challengeList}
                />
              ) : (
                <Text style={styles.noChallengesText}>
                  You haven't created any challenges yet.
                </Text>
              )}
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
  myChallengesContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  myChallengesTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007bff",
    marginBottom: 10,
  },
  challengeList: {
    paddingVertical: 10,
  },
  challengeCard: {
    backgroundColor: "#ffffff",
    marginRight: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4.65,
    elevation: 4,
    width: 150,
    alignItems: "center",
    padding: 10,
  },
  challengeImage: {
    width: "100%",
    height: 100,
    borderRadius: 10,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginTop: 8,
  },
  noChallengesText: {
    textAlign: "center",
    color: "#9e9e9e",
    fontSize: 14,
  },
});

export default ProfileScreen;
