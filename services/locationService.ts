import * as Location from "expo-location";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

// Récupère la localisation réelle, reverse-geocode, et met à jour Firestore
export const fetchAndSaveUserLocation = async (): Promise<boolean> => {
  try {
    // 1. Permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("🔍 Permission localisation:", status);
    if (status !== "granted") {
      console.warn("⚠️ Permission de localisation refusée.");
      return false;
    }

    // 2. Récupère la position GPS réelle
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });
    console.log(
      "📍 Coordonnées GPS réelles:",
      location.coords.latitude,
      location.coords.longitude
    );

    // 3. Reverse geocode
    let geocode: Location.LocationGeocodedAddress[] = [];
    try {
      geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log("🌍 Réponse reverseGeocode:", geocode);
    } catch (e) {
      console.warn("⚠️ Échec reverseGeocode, on utilise fallback Madrid.", e);
    }

    // 4. Détermine country/region
    let country: string = "Spain";
    let region: string = "Community of Madrid";

    if (geocode.length > 0) {
      const addr = geocode[0];
      country = addr.country ?? country;
      region = addr.region ?? addr.subregion ?? region;

      // normalisation
      if (country === "España" || country === "ES") country = "Spain";
      if (region === "Madrid" || region === "Comunidad de Madrid")
        region = "Community of Madrid";
    }

    console.log("✅ Pays:", country, "🏞️ Région:", region);

    // 5. Met à jour Firestore
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté.");
      return false;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.warn("⚠️ Doc utilisateur introuvable:", userId);
      return false;
    }

    await updateDoc(userRef, {
      country,
      region,
      locationEnabled: status === "granted",
      updatedAt: serverTimestamp(),
    });

    console.log(
      `✅ Localisation enregistrée pour ${userId} : ${region}, ${country}`
    );
    return true;
  } catch (error) {
    console.error("❌ Erreur fetchAndSaveUserLocation:", error);
    return false;
  }
};
