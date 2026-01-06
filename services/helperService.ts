// src/services/helperService.ts

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase-config";

export type ChallengeHelperContent = {
  titre: string;
  image: string;
  miniCours: string;
  exemples: string[];
  ressources: {
    title: string;
    url: string;
    type: string;
  }[];
  chatId: string;
  illustrationSuggeree?: string;
  imageHelper?: string;
  
};


/**
 * Récupère le contenu d'aide contextuelle pour un challenge donné
 * @param challengeId L'identifiant du challenge
 * @returns Le contenu d'aide ou null s'il n'existe pas
 */
export const getChallengeHelper = async (
  challengeId: string
): Promise<ChallengeHelperContent | null> => {
  try {
    const ref = doc(db, "challenge-helpers", challengeId);
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      return snapshot.data() as ChallengeHelperContent;
    } else {
      return null;
    }
  } catch (error) {
    console.error("❌ Erreur récupération du challenge helper:", error);
    return null;
  }
};
