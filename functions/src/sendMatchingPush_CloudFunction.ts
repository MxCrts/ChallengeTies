import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// admin.initializeApp() doit être appelé dans index.ts, pas ici

type MatchingPushParams = {
  type: "matching_invite_received" | "matching_invite_accepted" | "matching_invite_refused";
  inviteeId: string;       // uid du destinataire de la push
  inviterId: string;
  inviterUsername: string;
  challengeTitle: string;
  challengeId: string;
  selectedDays: number;
  inviteId: string;
};

// Traductions minimales pour les push (côté serveur)
const PUSH_TEXTS: Record<string, Record<string, { title: string; body: string }>> = {
  matching_invite_received: {
    fr: {
      title: "Nouveau binôme disponible ! 🎯",
      body: "{{username}} t'invite à relever «{{challenge}}» ensemble.",
    },
    en: {
      title: "New duo partner! 🎯",
      body: "{{username}} invites you to tackle «{{challenge}}» together.",
    },
    de: {
      title: "Neuer Duo-Partner! 🎯",
      body: "{{username}} lädt dich ein, «{{challenge}}» gemeinsam anzugehen.",
    },
    es: {
      title: "¡Nuevo compañero disponible! 🎯",
      body: "{{username}} te invita a «{{challenge}}» juntos.",
    },
    it: {
      title: "Nuovo partner disponibile! 🎯",
      body: "{{username}} ti invita a «{{challenge}}» insieme.",
    },
    pt: {
      title: "Novo parceiro disponível! 🎯",
      body: "{{username}} te convida para «{{challenge}}» juntos.",
    },
    nl: {
      title: "Nieuwe duo-partner! 🎯",
      body: "{{username}} nodigt je uit voor «{{challenge}}» samen.",
    },
    ru: {
      title: "Новый партнёр! 🎯",
      body: "{{username}} приглашает тебя на «{{challenge}}» вместе.",
    },
    ar: {
      title: "شريك جديد متاح! 🎯",
      body: "{{username}} يدعوك للانضمام إلى «{{challenge}}».",
    },
    zh: {
      title: "新搭档来了！🎯",
      body: "{{username}} 邀请你一起挑战《{{challenge}}》。",
    },
    ja: {
      title: "新しいパートナー！🎯",
      body: "{{username}} が「{{challenge}}」に誘っています。",
    },
    ko: {
      title: "새 파트너! 🎯",
      body: "{{username}}님이 «{{challenge}}»에 초대했습니다.",
    },
    hi: {
      title: "नया साथी मिला! 🎯",
      body: "{{username}} ने «{{challenge}}» के लिए आपको आमंत्रित किया।",
    },
  },
  matching_invite_accepted: {
    fr: {
      title: "Binôme accepté ! 🔥",
      body: "{{username}} a accepté de relever «{{challenge}}» avec toi !",
    },
    en: {
      title: "Duo accepted! 🔥",
      body: "{{username}} accepted to tackle «{{challenge}}» with you!",
    },
    de: { title: "Duo akzeptiert! 🔥", body: "{{username}} hat «{{challenge}}» mit dir angenommen!" },
    es: { title: "¡Dúo aceptado! 🔥", body: "{{username}} aceptó «{{challenge}}» contigo." },
    it: { title: "Duo accettato! 🔥", body: "{{username}} ha accettato «{{challenge}}» con te!" },
    pt: { title: "Duo aceite! 🔥", body: "{{username}} aceitou «{{challenge}}» com você!" },
    nl: { title: "Duo geaccepteerd! 🔥", body: "{{username}} accepteerde «{{challenge}}» met jou!" },
    ru: { title: "Дуэт принят! 🔥", body: "{{username}} принял «{{challenge}}» с тобой!" },
    ar: { title: "تم قبول الثنائي! 🔥", body: "{{username}} قبل «{{challenge}}» معك!" },
    zh: { title: "搭档已接受！🔥", body: "{{username}} 接受了与你一起挑战《{{challenge}}》！" },
    ja: { title: "デュオ承認！🔥", body: "{{username}} が「{{challenge}}」を一緒に受け入れました！" },
    ko: { title: "듀오 수락! 🔥", body: "{{username}}님이 «{{challenge}}»를 함께 수락했습니다!" },
    hi: { title: "डुओ स्वीकार! 🔥", body: "{{username}} ने «{{challenge}}» आपके साथ स्वीकार किया!" },
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/{{(\w+)}}/g, (_, key) => vars[key] || "");
}

export const sendMatchingPush = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Non authentifié.");
    }
    const { type, inviteeId, inviterUsername, challengeTitle, challengeId, selectedDays, inviteId } = request.data as MatchingPushParams;

    if (!inviteeId || !type) {
      throw new HttpsError("invalid-argument", "Paramètres manquants.");
    }

    try {
      // Récupérer le token push + langue du destinataire
      const userSnap = await admin.firestore().doc(`users/${inviteeId}`).get();
      if (!userSnap.exists) return { ok: false, reason: "user_not_found" };

      const userData = userSnap.data() as any;

      if (userData?.notificationsEnabled === false) {
        return { ok: false, reason: "notifications_disabled" };
      }

      const token: string | null = userData?.expoPushToken || null;
      const language: string = String(userData?.language || "en").split("-")[0].toLowerCase();

      if (!token) return { ok: false, reason: "no_token" };

      // Récupérer les textes dans la bonne langue
      const texts = PUSH_TEXTS[type]?.[language] || PUSH_TEXTS[type]?.["en"];
      if (!texts) return { ok: false, reason: "no_texts" };

      const vars = {
        username: inviterUsername || "Someone",
        challenge: challengeTitle || "challenge",
        days: String(selectedDays),
      };

      const title = interpolate(texts.title, vars);
      const body = interpolate(texts.body, vars);

      // Envoyer via Expo Push API
      const payload = {
        to: token,
        title,
        body,
        sound: "default",
        data: {
          type: "matching_invite",
          kind: type,
          challengeId,
          inviteId,
          selectedDays,
        },
      };

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result?.data?.status === "ok") {
        return { ok: true };
      } else {
        console.warn("Expo push failed:", JSON.stringify(result));
        return { ok: false, reason: "expo_push_failed" };
      }
    } catch (e: any) {
      console.error("sendMatchingPush error:", e?.message || e);
      return { ok: false, reason: "internal_error" };
    }
  });

// ================================================================
// DANS TON index.ts des functions, ajoute :
// export { sendMatchingPush } from "./sendMatchingPush";
// ================================================================
