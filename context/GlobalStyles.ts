import { StyleSheet } from "react-native";

export const LightTheme = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // 🌤️ Fond doux et moderne
    padding: 16,
  },
  text: {
    color: "#1F2937", // ✅ Texte bien contrasté
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007BFF",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  button: {
    backgroundColor: "#007BFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#007BFF",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  sectionBubble: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4.65,
    elevation: 3,
  },
});

export const DarkTheme = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // 🌙 Fond sombre élégant
    padding: 16,
  },
  text: {
    color: "#F3F4F6", // ✅ Texte bien visible en mode sombre
  },
  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FACC15", // 🎖️ Titre doré lumineux
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  button: {
    backgroundColor: "#FACC15",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#FACC15",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
  },
  buttonText: {
    color: "#1E1E1E",
    fontWeight: "bold",
    fontSize: 16,
  },
  sectionBubble: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111827",
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
});
