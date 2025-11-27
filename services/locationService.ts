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
    

    // 3. Reverse geocode
    let geocode: Location.LocationGeocodedAddress[] = [];
    try {
      geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
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

    
    return true;
  } catch (error) {
    console.error("❌ Erreur fetchAndSaveUserLocation:", error);
    return false;
  }
};

// ---------- Helpers pour Settings (toggles) ----------

export const enableLocationFromSettings = async (): Promise<boolean> => {
  try {
    const perm = await Location.getForegroundPermissionsAsync().catch(() => ({
      status: "undetermined" as const,
    }));
    let final = perm.status;

    if (final !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      final = req.status;
      if (final !== "granted") {
        return false; // refusé → Settings pourra ouvrir les réglages
      }
    }

    // Si granted → on peut snapshot la localisation
    await fetchAndSaveUserLocation();

    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, "users", uid), {
        locationEnabled: true,
        updatedAt: serverTimestamp(),
      });
    }

    return true;
  } catch (e) {
    console.error("❌ enableLocationFromSettings:", e);
    return false;
  }
};

export const disableLocationFromSettings = async (): Promise<void> => {
  try {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, "users", uid), {
        locationEnabled: false,
        country: "Unknown",
        region: "Unknown",
        updatedAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error("❌ disableLocationFromSettings:", e);
  }
};
