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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Card, Divider } from "react-native-paper";
import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";

const { width } = Dimensions.get("window");

const ProfileScreen = () => {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [myChallenges, setMyChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(false);

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
    {
      name: "Completed Challenges",
      icon: "checkmark-done-outline",
      navigateTo: "profile/CompletedChallenges",
    },
    {
      name: "Achievements",
      icon: "medal-outline",
      navigateTo: "profile/Achievements",
    },
  ];

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    const userRef = doc(db, "users", currentUser.uid);
    setIsLoading(true);

    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchMyChallenges = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      setLoadingChallenges(true);
      const challengesRef = collection(db, "challenges");
      const q = query(challengesRef, where("creatorId", "==", userId));
      const querySnapshot = await getDocs(q);

      const challenges = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        title: docSnap.data().title || "Untitled Challenge",
        category: docSnap.data().category || "Uncategorized",
        description: docSnap.data().description || "No description available",
        imageUrl: docSnap.data().imageUrl || null,
      }));

      setMyChallenges(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
    } finally {
      setLoadingChallenges(false);
    }
  };

  useEffect(() => {
    fetchMyChallenges();
  }, []);

  const renderSection = ({ item }) => (
    <TouchableOpacity
      onPress={() => router.push(item.navigateTo)}
      style={styles.sectionBubble}
    >
      <Ionicons name={item.icon} size={40} color="#FFA500" />
      <Text style={styles.sectionText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderChallenge = ({ item }) => (
    <TouchableOpacity
      style={styles.challengeCard}
      onPress={() =>
        router.push({
          pathname: "/challenge-details/[id]",
          params: {
            id: item.id,
            title: item.title,
            category: item.category,
            description: item.description,
          },
        })
      }
    >
      <Card>
        <Card.Cover
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require("../../assets/images/default-challenge.webp")
          }
          style={styles.challengeImage}
        />
        <Card.Title
          title={item.title}
          subtitle={item.category}
          titleStyle={styles.challengeTitle}
        />
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFA500" />
        <Text style={styles.loadingText}>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Avatar.Image
            size={120}
            source={
              userData?.profileImage
                ? { uri: userData.profileImage }
                : require("../../assets/images/default-profile.jpg")
            }
          />
          <Text style={styles.username}>
            {userData?.displayName || "Anonymous"}
          </Text>
          <Text style={styles.bio}>{userData?.bio || "No bio available"}</Text>
          <View style={styles.trophiesContainer}>
            <Ionicons name="trophy-outline" size={24} color="#FFD700" />
            <Text style={styles.trophiesText}>
              {userData?.trophies || 0} Trophies
            </Text>
          </View>
        </View>

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

        {/* My Challenges */}
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
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  contentContainer: {
    paddingBottom: 60,
  },
  header: {
    alignItems: "center",
    backgroundColor: "#007bff",
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  bio: {
    fontSize: 14,
    color: "#f1f1f1",
    textAlign: "center",
    marginTop: 5,
  },
  trophiesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  trophiesText: {
    fontSize: 16,
    color: "#FFD700",
    fontWeight: "bold",
    marginLeft: 5,
  },
  sectionBubble: {
    flex: 1,
    alignItems: "center",
    margin: 10,
    backgroundColor: "#fff",
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 4,
  },
  myChallengesContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
});
