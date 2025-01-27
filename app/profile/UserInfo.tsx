import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../constants/firebase-config";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

interface User {
  uid: string;
  displayName?: string;
  bio?: string;
  profileImage?: string | null;
  location?: string;
  interests?: string;
  website?: string;
}

const { width } = Dimensions.get("window");

export default function UserInfo() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // NEW FIELDS
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState("");
  const [website, setWebsite] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error("User is not authenticated.");
        }

        const userId = currentUser.uid;
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as Omit<User, "uid">;
          setUser({ uid: userId, ...userData });
          setDisplayName(userData.displayName || "");
          setBio(userData.bio || "");
          setProfileImage(userData.profileImage || null);
          setLocation(userData.location || "");
          setInterests(userData.interests || "");
          setWebsite(userData.website || "");
        } else {
          setUser({
            uid: userId,
            displayName: "",
            bio: "",
            profileImage: null,
            location: "",
            interests: "",
            website: "",
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to fetch user details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Camera roll permissions are required."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
      Alert.alert("Error", "There was an error picking the image.");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Error", "User ID not found.");
      return;
    }

    setIsLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
        profileImage,
        location,
        interests,
        website,
      });

      Alert.alert("Success", "Profile updated successfully!");
      router.push("/(tabs)/profile");
    } catch (error) {
      console.error("Error updating user info:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user, displayName, bio, profileImage, location, interests, website]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8bc34a" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#1C1C1E", "#262629"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={70} color="#fff" />
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>
            Update your avatar and personal details.
          </Text>
        </View>

        {/* Profile Image */}
        <View style={styles.imageContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={pickImage}
            >
              <Ionicons name="add-circle-outline" size={50} color="#8bc34a" />
              <Text style={styles.addImageText}>Add Profile Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Form Fields */}
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#aaa"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Bio"
          placeholderTextColor="#aaa"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
        />

        <TextInput
          style={styles.input}
          placeholder="Location"
          placeholderTextColor="#aaa"
          value={location}
          onChangeText={setLocation}
        />

        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Interests (e.g. Hiking, Cooking, Tech...)"
          placeholderTextColor="#aaa"
          value={interests}
          onChangeText={setInterests}
          multiline
          numberOfLines={2}
        />

        <TextInput
          style={styles.input}
          placeholder="Website (Optional)"
          placeholderTextColor="#aaa"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: "center",
    paddingBottom: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 5,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
    maxWidth: width * 0.8,
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#8bc34a",
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#8bc34a",
    borderRadius: 60,
  },
  addImageText: {
    marginTop: 8,
    color: "#8bc34a",
    fontSize: 14,
  },
  input: {
    width: "100%",
    backgroundColor: "#2C2C2E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: "#fff",
    fontSize: 15,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#8bc34a",
    padding: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginTop: 5,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
});
