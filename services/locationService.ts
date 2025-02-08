import * as Location from "expo-location";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

// ✅ Fonction pour récupérer la localisation et l'enregistrer dans Firestore
export const fetchAndSaveUserLocation = async () => {
  try {
    // Demander la permission de localisation
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("⚠️ Permission de localisation refusée.");
      return;
    }

    // Récupérer la position GPS
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    // Utiliser l'API Google pour récupérer pays/région (REMPLACE `TON_API_KEY`)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=TON_API_KEY`
    );
    const data = await response.json();

    // Extraire pays et région
    const addressComponents = data.results[0]?.address_components || [];
    const country = addressComponents.find((c) =>
      c.types.includes("country")
    )?.long_name;
    const region = addressComponents.find((c) =>
      c.types.includes("administrative_area_level_1")
    )?.long_name;

    if (!country || !region) {
      console.warn("⚠️ Impossible de récupérer le pays ou la région.");
      return;
    }

    // Récupérer l'ID utilisateur
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      // Mettre à jour la localisation dans Firestore
      await updateDoc(userRef, {
        country,
        region,
      });
      console.log(`✅ Localisation enregistrée : ${region}, ${country}`);
    }
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération de la localisation :",
      error
    );
  }
};
