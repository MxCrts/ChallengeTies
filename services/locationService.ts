import * as Location from "expo-location";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";

// ✅ Fonction pour récupérer la localisation et l'enregistrer dans Firestore
export const fetchAndSaveUserLocation = async (): Promise<boolean> => {
  try {
    // Vérifier les permissions de localisation
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("🔍 Permission localisation:", status); // Log
    if (status !== "granted") {
      console.warn("⚠️ Permission de localisation refusée.");
      return false;
    }

    // Forcer les coordonnées GPS de Madrid pour tests
    const location = {
      coords: {
        latitude: 40.416775,
        longitude: -3.70379,
      },
    } as Location.LocationObject;
    console.log(
      "📍 Coordonnées GPS forcées (Madrid):",
      location.coords.latitude,
      location.coords.longitude
    ); // Log

    // Utiliser reverseGeocodeAsync pour obtenir les détails de l'adresse
    const geocode = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    console.log("🌍 Réponse reverseGeocode:", JSON.stringify(geocode, null, 2)); // Log

    // Extraire pays et région
    let country: string | null = null;
    let region: string | null = null;

    if (geocode[0]) {
      const address: Location.LocationGeocodedAddress = geocode[0];
      country = address.country ?? null;
      region = address.region ?? address.subregion ?? null;
    }

    // Normalisation et fallback pour Madrid
    if (!country || !region) {
      console.warn(
        "⚠️ Pays ou région non trouvés, utilisation fallback Madrid."
      );
      country = "Spain";
      region = "Community of Madrid";
    } else {
      // Normaliser pour cohérence
      country = country === "España" || country === "ES" ? "Spain" : country;
      region =
        region === "Madrid" || region === "Comunidad de Madrid"
          ? "Community of Madrid"
          : region;
    }

    console.log("🇪🇸 Pays:", country, "🏞️ Région:", region); // Log

    // Vérifier l'utilisateur connecté
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté.");
      return false;
    }

    // Vérifier l'existence du document utilisateur
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.warn("⚠️ Document utilisateur non trouvé pour userId:", userId);
      return false;
    }

    // Mettre à jour Firestore
    await updateDoc(userRef, {
      country,
      region,
      locationEnabled: true,
    });
    console.log(
      `✅ Localisation enregistrée : ${region}, ${country}, userId: ${userId}`
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération de la localisation :",
      error
    );
    return false;
  }
};
