import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // Corrected import
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../constants/firebase-config";

export default function CreateChallenge() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Health");
  const [days, setDays] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const router = useRouter();

  const categories = [
    "Health",
    "Fitness",
    "Finance",
    "Productivity",
    "Creativity",
    "Education",
    "Career",
    "Lifestyle",
    "Social",
    "Miscellaneous",
  ];

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !category || !days) {
      Alert.alert("Error", "All fields (except image) are required.");
      return;
    }

    try {
      await addDoc(collection(db, "challenges"), {
        title,
        description,
        category,
        days: parseInt(days, 10),
        imageUrl: imageUri || null,
        participantsCount: 0,
        createdAt: new Date(),
      });

      Alert.alert("Success", "Challenge created successfully!");
      router.push("/explore");
    } catch (error) {
      console.error("Error creating challenge:", error);
      Alert.alert("Error", "Failed to create challenge. Try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create a New Challenge</Text>
      <TextInput
        style={styles.input}
        placeholder="Challenge Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />
      <View style={styles.dropdownContainer}>
        <Text style={styles.dropdownLabel}>Category</Text>
        <Picker
          selectedValue={category}
          onValueChange={(itemValue: string) => setCategory(itemValue)} // Fixed type
          style={styles.dropdown}
        >
          {categories.map((cat) => (
            <Picker.Item label={cat} value={cat} key={cat} />
          ))}
        </Picker>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Number of Days"
        keyboardType="numeric"
        value={days}
        onChangeText={setDays}
      />
      <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
        <Text style={styles.imagePickerText}>
          {imageUri ? "Change Image" : "Upload Image (Optional)"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>Create Challenge</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1C1C1E",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#2C2C2E",
    color: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  dropdownContainer: {
    marginBottom: 15,
  },
  dropdownLabel: {
    color: "#bbb",
    marginBottom: 5,
  },
  dropdown: {
    backgroundColor: "#2C2C2E",
    color: "#fff",
    borderRadius: 10,
    padding: 10,
  },
  imagePickerButton: {
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  imagePickerText: {
    color: "#fff",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
