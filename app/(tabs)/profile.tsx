import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSavedChallenges } from "../../context/SavedChallengesContext";
import ProgressBar from "react-native-progress/Bar";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn, FadeOut, Layout } from "react-native-reanimated";

const ProfilePage = () => {
  const [profile, setProfile] = useState({
    name: "John Doe",
    bio: "Adventurer. Challenge enthusiast. Coffee lover.",
    profilePicture: "https://via.placeholder.com/150",
    challengesCompleted: 5,
    challengesOngoing: 2,
    successRate: 72,
    longestStreak: 10,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editableName, setEditableName] = useState(profile.name);
  const [editableBio, setEditableBio] = useState(profile.bio);

  const { savedChallenges, currentChallenges, removeChallenge, markToday } =
    useSavedChallenges();
  const navigation = useNavigation();

  const handleRemoveChallenge = (id: string) => {
    Alert.alert(
      "Remove Challenge",
      "Are you sure you want to remove this saved challenge?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeChallenge(id),
        },
      ]
    );
  };

  const handleSaveEdit = () => {
    setProfile({ ...profile, name: editableName, bio: editableBio });
    setIsEditing(false);
  };

  const navigateToChallengeDetails = (id: string) => {
    navigation.navigate("ChallengeDetails" as never, { id } as never);
  };

  const renderChallengeCard = (item: any, isCurrent: boolean) => (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      layout={Layout.springify()}
      style={styles.card}
    >
      <TouchableOpacity onPress={() => navigateToChallengeDetails(item.id)}>
        <Text style={styles.cardTitle}>{item.title}</Text>
      </TouchableOpacity>
      <View style={styles.cardDivider} />
      <Text style={styles.challengeCategory}>
        {item.category || "Uncategorized"}
      </Text>
      {isCurrent ? (
        <>
          <ProgressBar
            progress={(item.completedDays ?? 0) / (item.totalDays ?? 1)}
            width={null}
            color="#007bff"
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {item.completedDays ?? 0} / {item.totalDays ?? 1} Days Completed
          </Text>
          <TouchableOpacity
            style={styles.markButton}
            onPress={() => markToday(item.id)}
            disabled={item.lastMarkedDate === new Date().toDateString()}
          >
            <Text style={styles.markButtonText}>
              {item.lastMarkedDate === new Date().toDateString()
                ? "Marked Today"
                : "Mark Today"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={styles.trashButton}
          onPress={() => handleRemoveChallenge(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  return (
    <ImageBackground
      source={require("../../assets/images/background.jpg")}
      style={styles.container}
    >
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Image
                source={{ uri: profile.profilePicture }}
                style={styles.profileImage}
              />
              <View style={styles.headerText}>
                <Text style={styles.name}>{profile.name}</Text>
                <Text style={styles.bio}>{profile.bio}</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons name="create-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.statsSection}>
              {[profile.challengesCompleted, profile.challengesOngoing].map(
                (value, index) => (
                  <View key={index} style={styles.statsBox}>
                    <Text style={styles.statNumber}>{value}</Text>
                  </View>
                )
              )}
            </View>
          </>
        }
        data={savedChallenges}
        renderItem={({ item }) => renderChallengeCard(item, false)}
      />
      <Text style={styles.sectionTitle}>Current Challenges</Text>
      <FlatList
        data={currentChallenges}
        renderItem={({ item }) => renderChallengeCard(item, true)}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  header: { flexDirection: "row" },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginRight: 15 },
  headerText: { flex: 1 },
  name: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  bio: { fontSize: 16, fontStyle: "italic", color: "#bbb" },
  editButton: { backgroundColor: "#007bff", padding: 10, borderRadius: 5 },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  statsBox: {
    width: "45%",
    backgroundColor: "#1c1c1c",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  statNumber: { fontSize: 22, color: "#007bff" },
  statLabel: { fontSize: 14, color: "#bbb" },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  card: { padding: 15, backgroundColor: "#1c1c1c", borderRadius: 8 },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#007bff" },
  cardDivider: { height: 1, backgroundColor: "#333", marginVertical: 10 },
  challengeCategory: { fontSize: 14, color: "#bbb", marginBottom: 10 },
  progressBar: { marginBottom: 10 },
  progressText: { color: "#fff" },
  markButton: { backgroundColor: "#007bff", padding: 10, borderRadius: 5 },
  markButtonText: { color: "#fff", fontWeight: "bold" },
  trashButton: { alignSelf: "flex-end" },
});

export default ProfilePage;
