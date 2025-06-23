import React, { createContext, useContext, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configuration du gestionnaire de notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true, // Ajout
    shouldShowList: true,
  }),
});

interface NotificationsContextType {
  scheduleDailyReminder: () => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(
  null
);

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  // Fonction d'enregistrement et de demande des permissions
  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      alert("Échec de l'obtention des permissions de notifications !");
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Push token:", token);
  };

  // Planifie une notification quotidienne à 18h
  const scheduleDailyReminder = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY, // Utilise la constante
      hour: 18,
      minute: 0,
    };

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Rappel Challenge",
        body: "N'oublie pas de marquer ton défi du jour !",
      },
      trigger,
    });
  };

  // Permet d'annuler toutes les notifications programmées
  const cancelAllNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  return (
    <NotificationsContext.Provider
      value={{ scheduleDailyReminder, cancelAllNotifications }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
};
