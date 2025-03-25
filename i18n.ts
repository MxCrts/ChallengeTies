// i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

const resources = {
  en: {
    translation: {
      settings: "Settings",
      notifications: "Notifications",
      darkMode: "Dark Mode",
      language: "Language",
      account: "Account",
      editProfile: "Edit Profile",
      logout: "Logout",
      deleteAccount: "Delete Account",
      clearCache: "Clear Cache",
      about: "About",
      appVersion: "App Version: {{version}}",
      // Ajoutez d'autres clés ici...
    },
  },
  fr: {
    translation: {
      settings: "Paramètres",
      notifications: "Notifications",
      darkMode: "Mode sombre",
      language: "Langue",
      account: "Compte",
      editProfile: "Modifier mon profil",
      logout: "Se déconnecter",
      deleteAccount: "Supprimer mon compte",
      clearCache: "Vider le cache",
      about: "À propos",
      appVersion: "Version de l'application : {{version}}",
      // ...
    },
  },
  es: {
    translation: {
      settings: "Ajustes",
      notifications: "Notificaciones",
      darkMode: "Modo oscuro",
      language: "Idioma",
      account: "Cuenta",
      editProfile: "Editar perfil",
      logout: "Cerrar sesión",
      deleteAccount: "Eliminar cuenta",
      clearCache: "Limpiar caché",
      about: "Acerca de",
      appVersion: "Versión de la aplicación: {{version}}",
      // ...
    },
  },
  de: {
    translation: {
      settings: "Einstellungen",
      notifications: "Benachrichtigungen",
      darkMode: "Dunkelmodus",
      language: "Sprache",
      account: "Konto",
      editProfile: "Profil bearbeiten",
      logout: "Abmelden",
      deleteAccount: "Konto löschen",
      clearCache: "Cache leeren",
      about: "Über",
      appVersion: "App-Version: {{version}}",
      // ...
    },
  },
  zh: {
    translation: {
      settings: "设置",
      notifications: "通知",
      darkMode: "暗黑模式",
      language: "语言",
      account: "账户",
      editProfile: "编辑个人资料",
      logout: "登出",
      deleteAccount: "删除账户",
      clearCache: "清除缓存",
      about: "关于",
      appVersion: "应用版本：{{version}}",
      // ...
    },
  },
};

i18n
  .use(initReactI18next) // passe i18n à react-i18next
  .init({
    resources,
    lng: Localization.locale.split("-")[0], // langue par défaut selon l'appareil
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React gère déjà l'échappement
    },
  });

export default i18n;
