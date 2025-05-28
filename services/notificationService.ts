import * as Notifications from "expo-notifications";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../constants/firebase-config";
import i18n from "../i18n";

// Configurer le handler de notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Afficher la notification en bannière
    shouldShowList: true, // Afficher dans la liste des notifications
    shouldPlaySound: true, // Jouer un son
    shouldSetBadge: false, // Pas de badge sur l'icône
  }),
});

// ✅ Demander les permissions de notifications
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log("🔔 Permission notifications:", status);
    return status === "granted";
  } catch (error) {
    console.error("❌ Erreur permission notifications:", error);
    return false;
  }
};

// ✅ Planifier les notifications quotidiennes
export const scheduleDailyNotifications = async (): Promise<boolean> => {
  try {
    // Annuler les anciennes notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("🗑️ Anciennes notifications annulées");

    // Vérifier l'utilisateur et notificationsEnabled
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.warn("⚠️ Aucun utilisateur connecté");
      return false;
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists() || !userSnap.data().notificationsEnabled) {
      console.warn("⚠️ Notifications désactivées ou utilisateur non trouvé");
      return false;
    }

    const language = userSnap.data().language || "en";
    console.log("🗣️ Langue pour notifications:", language);

    // Définir les messages
    const morningMessages = [
      i18n.t("notifications.morning1", { lng: language }),
      i18n.t("notifications.morning2", { lng: language }),
    ];
    const eveningMessages = [
      i18n.t("notifications.evening1", { lng: language }),
      i18n.t("notifications.evening2", { lng: language }),
    ];

    // Planifier notification matin (11h)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notifications.title", { lng: language }),
        body: morningMessages[
          Math.floor(Math.random() * morningMessages.length)
        ],
      },
      trigger: {
        type: "daily",
        hour: 10,
        minute: 0,
        repeats: true,
      } as Notifications.DailyTriggerInput,
    });

    // Planifier notification soir (20h)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("notifications.title", { lng: language }),
        body: eveningMessages[
          Math.floor(Math.random() * eveningMessages.length)
        ],
      },
      trigger: {
        type: "daily",
        hour: 20,
        minute: 0,
        repeats: true,
      } as Notifications.DailyTriggerInput,
    });

    console.log("🔔 Notifications planifiées : 11h et 20h");
    return true;
  } catch (error) {
    console.error("❌ Erreur planification notifications:", error);
    return false;
  }
};
