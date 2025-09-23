// src/privacy/consent.ts
import {
  AdsConsent,
  AdsConsentStatus,
  AdsConsentPrivacyOptionsRequirementStatus,
  // 👉 décommente en dev si tu veux forcer l'EEA pour tester :
  // AdsConsentDebugGeography,
} from 'react-native-google-mobile-ads';

/**
 * Appelé au démarrage de l’app.
 * - récupère/affiche le formulaire UMP si nécessaire
 * - calcule le flag NPA (non-personnalisée) et le expose en global
 */
export async function initConsent(): Promise<{ npa: boolean; canRequestAds: boolean }> {
  try {
    // 1) Mets à jour les infos de consentement (et option debug en dev si besoin)
    const info = await AdsConsent.requestInfoUpdate({
      // ⚠️ pour tester le flux en Europe, décommente en dev :
      // debugGeography: AdsConsentDebugGeography.EEA,
      // testDeviceIdentifiers: ['TEST-DEVICE-ID'],
    });

    // 2) Si un formulaire est requis/dispo → l'afficher
    if (
      info.isConsentFormAvailable &&
      (info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN)
    ) {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }
  } catch (e) {
    console.warn('UMP init: request/show form failed → fallback NPA', e);
  }

  // 3) Calcule le flag NPA à partir des choix réels de l’utilisateur
  try {
    const choices = await AdsConsent.getUserChoices();
    const consentInfo = await AdsConsent.getConsentInfo();

    // Personalized si l’utilisateur a autorisé la sélection d’annonces personnalisées
    const personalizedAllowed = choices?.selectPersonalisedAds === true;

    const npa = !personalizedAllowed; // si pas de perso → NPA true
    (globalThis as any).__NPA__ = npa;

    return { npa, canRequestAds: consentInfo.canRequestAds };
  } catch (e) {
    console.warn('UMP getUserChoices failed → NPA par défaut (safe)', e);
    (globalThis as any).__NPA__ = true; // par sécurité
    return { npa: true, canRequestAds: true };
  }
}

/**
 * À appeler depuis un bouton “Gérer mes choix”.
 * Affiche le formulaire de gestion des préférences si requis/dispo.
 */
export async function openPrivacyOptionsIfAvailable(): Promise<boolean> {
  try {
    const info = await AdsConsent.getConsentInfo();
    if (
      info.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
    ) {
      await AdsConsent.showPrivacyOptionsForm();
      return true;
    }
    return false;
  } catch (e) {
    console.warn('UMP privacy options failed', e);
    return false;
  }
}
