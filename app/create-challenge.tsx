import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { collection, addDoc, updateDoc, arrayUnion, doc } from "firebase/firestore";
import { auth, db } from "../constants/firebase-config";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { checkForAchievements } from "../helpers/trophiesHelpers";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";
import designSystem, { Theme } from "../theme/designSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPACING = 20;
const BORDER_RADIUS = 16;

const defaultDaysOptions = [7, 15, 21, 30, 60, 90, 180, 365];
const defaultCategories = [
  "Santé", "Fitness", "Finance", "Mode de Vie", "Éducation", "Créativité",
  "Carrière", "Social", "Productivité", "Écologie", "Motivation",
  "Développement Personnel", "Discipline", "État d'esprit", "Autres"
];

export default function CreateChallenge() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const current = isDark ? designSystem.darkTheme : designSystem.lightTheme;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategories[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  // Ad setup omitted for brevity

  const pickImage = useCallback(async () => {
    try {
      const { canceled, assets } = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!canceled && assets?.[0]?.uri) setImageUri(assets[0].uri);
    } catch {
      Alert.alert(t("error"), t("imagePickFailed"));
    }
  }, [t]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert(t("error"), t("allFieldsRequired"));
      return;
    }
    // Submit logic...
    router.push("/explore");
  }, [title, description, category, imageUri]);

  const isValid = title && description;

  return (
    <LinearGradient
      colors={[current.colors.background, current.colors.cardBackground]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: current.colors.primary }]}>          
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Ionicons name="create-outline" size={48} color="#fff" style={{ marginBottom: 8 }} />
          <Text style={styles.title}>{t("createYourChallenge")}</Text>
          <Text style={styles.subtitle}>{t("inspireOthers")}</Text>
        </View>

        <View style={[styles.form, { backgroundColor: current.colors.cardBackground }]}>          
          <Input label={t("challengeTitle")} value={title} onChange={setTitle} theme={current} />
          <Input
            label={t("challengeDescription")}
            value={description}
            onChange={setDescription}
            multiline
            numberOfLines={4}
            theme={current}
          />

          <Dropdown
            label={t("category")}
            options={defaultCategories}
            selected={category}
            onSelect={setCategory}
            theme={current}
          />

          <ImageUpload uri={imageUri} onPick={pickImage} theme={current} />

          <Button
            label={t("createChallengeButton")}
            onPress={handleSubmit}
            disabled={!isValid}
            theme={current}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// Reusable Components
const Input = ({ label, value, onChange, multiline = false, numberOfLines = 1, theme }: any) => (
  <View style={{ marginBottom: SPACING }}>
    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    <TextInput
      style={[
        styles.input,
        { backgroundColor: theme.colors.background, color: theme.colors.textPrimary, height: multiline ? 100 : 48 },
      ]}
      placeholder={label}
      placeholderTextColor={theme.colors.textSecondary}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={numberOfLines}
    />
  </View>
);

const Dropdown = ({ label, options, selected, onSelect, theme }: any) => (
  <View style={{ marginBottom: SPACING }}>
    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
    <View style={[styles.dropdown, { backgroundColor: theme.colors.background }]}>            
      <Picker selectedValue={selected} onValueChange={onSelect} style={{ color: theme.colors.textPrimary }}>
        {options.map((opt) => (
          <Picker.Item key={opt} label={opt} value={opt} />
        ))}
      </Picker>
    </View>
  </View>
);

const ImageUpload = ({ uri, onPick, theme }: any) => (
  <TouchableOpacity style={[styles.imageBox, { backgroundColor: theme.colors.background }]} onPress={onPick}>
    {uri ? (
      <Image source={{ uri }} style={styles.imagePreview} />
    ) : (
      <Ionicons name="cloud-upload-outline" size={32} color={theme.colors.textSecondary} />
    )}
  </TouchableOpacity>
);

const Button = ({ label, onPress, disabled, theme }: any) => (
  <TouchableOpacity disabled={disabled} onPress={onPress} style={{ opacity: disabled ? 0.5 : 1 }}>
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.secondary]}
      style={styles.button}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={[styles.buttonText, { color: theme.colors.textPrimary }]}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING, alignItems: 'center' },
  header: {
    width: '100%',
    borderRadius: BORDER_RADIUS,
    padding: SPACING,
    alignItems: 'center',
    marginBottom: SPACING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { fontSize: 24, color: '#fff', fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#fff', fontWeight: '400' },
  iconButton: { position: 'absolute', top: Platform.OS === 'android' ? StatusBar.currentHeight! + 8 : 8, left: 8 },
  form: {
    width: '100%',
    borderRadius: BORDER_RADIUS,
    padding: SPACING,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  inputLabel: { marginBottom: 6, fontSize: 14, fontWeight: '500' },
  input: {
    width: '100%',
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: SPACING,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '400',
  },
  dropdown: {
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    height: 150,
    borderRadius: BORDER_RADIUS,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING,
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS,
    alignItems: 'center',
  },
  buttonText: { fontSize: 18, fontWeight: '700' },
});