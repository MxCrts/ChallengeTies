"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWeeklyReport = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const db = (0, firestore_1.getFirestore)();
// ── Helpers date ──────────────────────────────────────────────────────────────
function toDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}
function getWeekDays(mondayDate) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mondayDate);
        d.setDate(mondayDate.getDate() + i);
        return toDateKey(d);
    });
}
function getMondayOf(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
}
// ── Calcul momentum score ─────────────────────────────────────────────────────
function computeMomentumScore(week0Days, // cette semaine (passée)
week1Days, // il y a 1 semaine
week2Days, // il y a 2 semaines
uniqueChallenges) {
    // Régularité (40%) — max = 7 jours
    const regularity = Math.min(week0Days / 7, 1) * 40;
    // Tendance (35%) — compare les 3 semaines
    const avg12 = (week1Days + week2Days) / 2 || 1;
    const trend = Math.min(Math.max(week0Days / avg12, 0), 2); // 0 à 2
    const trendScore = (trend / 2) * 35;
    // Intensité (25%) — nombre de défis différents
    const intensity = Math.min(uniqueChallenges / 3, 1) * 25;
    return Math.round(regularity + trendScore + intensity);
}
// ── Génère le diagnostic ──────────────────────────────────────────────────────
function generateDiagnostic(score, prevScore, week0Days, week1Days, streakBrokenThisWeek, lang) {
    const delta = score - prevScore;
    const isRising = delta >= 8;
    const isFalling = delta <= -8;
    const isStable = !isRising && !isFalling;
    const isConsistent = week0Days >= 5;
    const isIrregular = week0Days >= 3 && week0Days < 5 && week1Days >= 5;
    // Messages par langue (fr/en, fallback en)
    const msgs = {
        fr: {
            rising_consistent: "Tu construis quelque chose de solide. Chaque jour compte et ça se voit. Continue exactement comme ça.",
            rising_general: `Tu progresses semaine après semaine. ${delta > 0 ? `+${delta} points de momentum` : ""} — garde cette énergie.`,
            falling_broken: "Tu as cassé ta série mais tu t'es remis dessus. C'est ça la vraie discipline — pas la perfection, la résilience.",
            falling_general: "Ta semaine était plus douce que d'habitude. C'est normal. L'important c'est de ne pas laisser une mauvaise semaine en appeler une autre.",
            stable_consistent: "Tu es régulier comme une horloge. C'est exactement ce qui crée des résultats durables.",
            stable_irregular: "Tu marques beaucoup certains jours mais tu disparais les autres. Le secret c'est la régularité, pas l'intensité.",
            stable_general: "Tu avances. Pas spectaculaire cette semaine, mais tu avances. Et c'est ce qui compte.",
            zero: "Semaine difficile. On repart ensemble lundi. Un seul jour suffit pour relancer la machine.",
        },
        de: {
            rising_consistent: "Du baust etwas Solides auf. Jeder Tag zählt und das sieht man. Mach genau so weiter.",
            rising_general: `Du machst Woche für Woche Fortschritte. ${delta > 0 ? `+${delta} Momentum-Punkte` : ""} — behalte diese Energie.`,
            falling_broken: "Du hast deine Serie unterbrochen, bist aber wieder eingestiegen. Das ist echte Disziplin — nicht Perfektion, sondern Resilienz.",
            falling_general: "Diese Woche war sanfter als gewöhnlich. Das ist normal. Wichtig ist, eine schlechte Woche nicht zur nächsten werden zu lassen.",
            stable_consistent: "Du bist regelmäßig wie eine Uhr. Genau das schafft dauerhafte Ergebnisse.",
            stable_irregular: "Du markierst viel an manchen Tagen, aber verschwindest an anderen. Das Geheimnis ist Regelmäßigkeit, nicht Intensität.",
            stable_general: "Du machst Fortschritte. Nicht spektakulär diese Woche, aber du machst Fortschritte. Und das zählt.",
            zero: "Schwere Woche. Wir starten gemeinsam am Montag neu. Ein einziger Tag reicht, um die Maschine wieder anzuwerfen.",
        },
        es: {
            rising_consistent: "Estás construyendo algo sólido. Cada día cuenta y se nota. Sigue exactamente así.",
            rising_general: `Progresas semana tras semana. ${delta > 0 ? `+${delta} puntos de momentum` : ""} — mantén esa energía.`,
            falling_broken: "Rompiste tu racha pero volviste. Eso es la verdadera disciplina — no la perfección, la resiliencia.",
            falling_general: "Esta semana fue más suave de lo habitual. Es normal. Lo importante es no dejar que una mala semana llame a otra.",
            stable_consistent: "Eres regular como un reloj. Eso es exactamente lo que crea resultados duraderos.",
            stable_irregular: "Marcas mucho algunos días pero desapareces otros. El secreto es la regularidad, no la intensidad.",
            stable_general: "Avanzas. No espectacular esta semana, pero avanzas. Y eso es lo que cuenta.",
            zero: "Semana difícil. Volvemos juntos el lunes. Un solo día basta para arrancar la máquina.",
        },
        it: {
            rising_consistent: "Stai costruendo qualcosa di solido. Ogni giorno conta e si vede. Continua esattamente così.",
            rising_general: `Progredisci settimana dopo settimana. ${delta > 0 ? `+${delta} punti momentum` : ""} — mantieni questa energia.`,
            falling_broken: "Hai interrotto la tua serie ma sei tornato in pista. Questa è la vera disciplina — non la perfezione, la resilienza.",
            falling_general: "Questa settimana è stata più leggera del solito. È normale. L'importante è non lasciare che una brutta settimana ne chiami un'altra.",
            stable_consistent: "Sei regolare come un orologio. È esattamente questo che crea risultati duraturi.",
            stable_irregular: "Marchi molto certi giorni ma sparisci gli altri. Il segreto è la regolarità, non l'intensità.",
            stable_general: "Stai avanzando. Non spettacolare questa settimana, ma stai avanzando. Ed è questo che conta.",
            zero: "Settimana difficile. Ripartiamo insieme lunedì. Un solo giorno basta per rimettere in moto la macchina.",
        },
        pt: {
            rising_consistent: "Estás a construir algo sólido. Cada dia conta e isso nota-se. Continua exatamente assim.",
            rising_general: `Progredes semana após semana. ${delta > 0 ? `+${delta} pontos de momentum` : ""} — mantém essa energia.`,
            falling_broken: "Quebras-te a tua série mas voltaste. Isso é a verdadeira disciplina — não a perfeição, a resiliência.",
            falling_general: "Esta semana foi mais suave que o habitual. É normal. O importante é não deixar uma má semana chamar outra.",
            stable_consistent: "És regular como um relógio. É exatamente isso que cria resultados duradouros.",
            stable_irregular: "Marcas muito em certos dias mas desapareces noutros. O segredo é a regularidade, não a intensidade.",
            stable_general: "Estás a avançar. Não espetacular esta semana, mas estás a avançar. E é isso que conta.",
            zero: "Semana difícil. Recomeçamos juntos na segunda-feira. Um único dia chega para arrancar a máquina.",
        },
        nl: {
            rising_consistent: "Je bouwt iets solides op. Elke dag telt en dat zie je. Ga precies zo door.",
            rising_general: `Je maakt week na week vooruitgang. ${delta > 0 ? `+${delta} momentumpunten` : ""} — houd die energie vast.`,
            falling_broken: "Je hebt je reeks gebroken maar bent er weer ingestapt. Dat is echte discipline — niet perfectie, maar veerkracht.",
            falling_general: "Deze week was rustiger dan gewoonlijk. Dat is normaal. Het belangrijkste is niet één slechte week de volgende te laten worden.",
            stable_consistent: "Je bent regelmatig als een klok. Dat is precies wat blijvende resultaten creëert.",
            stable_irregular: "Je markeert veel op sommige dagen maar verdwijnt op andere. Het geheim is regelmaat, niet intensiteit.",
            stable_general: "Je gaat vooruit. Niet spectaculair deze week, maar je gaat vooruit. En dat telt.",
            zero: "Zware week. We beginnen maandag samen opnieuw. Één dag is genoeg om de machine weer op gang te brengen.",
        },
        ru: {
            rising_consistent: "Ты строишь что-то прочное. Каждый день важен, и это видно. Продолжай точно так же.",
            rising_general: `Ты прогрессируешь неделю за неделей. ${delta > 0 ? `+${delta} очков моментума` : ""} — сохраняй эту энергию.`,
            falling_broken: "Ты прервал серию, но вернулся. Это настоящая дисциплина — не совершенство, а устойчивость.",
            falling_general: "На этой неделе было спокойнее, чем обычно. Это нормально. Главное — не позволять одной плохой неделе тянуть за собой другую.",
            stable_consistent: "Ты регулярен, как часы. Именно это создаёт долгосрочные результаты.",
            stable_irregular: "Ты много отмечаешь в одни дни, но пропадаешь в другие. Секрет — в регулярности, а не в интенсивности.",
            stable_general: "Ты движешься вперёд. Не впечатляюще на этой неделе, но ты движешься. И это главное.",
            zero: "Тяжёлая неделя. Стартуем вместе в понедельник. Один день — достаточно, чтобы снова запустить машину.",
        },
        ar: {
            rising_consistent: "أنت تبني شيئاً راسخاً. كل يوم يُحسب وهذا واضح. استمر تماماً هكذا.",
            rising_general: `أنت تتقدم أسبوعاً بعد أسبوع. ${delta > 0 ? `+${delta} نقطة زخم` : ""} — حافظ على هذه الطاقة.`,
            falling_broken: "كسرت سلسلتك لكنك عدت إليها. هذه هي الانضباط الحقيقي — ليس الكمال، بل المرونة.",
            falling_general: "كان هذا الأسبوع أهدأ من المعتاد. هذا طبيعي. المهم ألا تدع أسبوعاً سيئاً يستدعي آخر.",
            stable_consistent: "أنت منتظم كالساعة. هذا بالضبط ما يخلق نتائج دائمة.",
            stable_irregular: "تُسجّل كثيراً في بعض الأيام لكنك تختفي في أخرى. السر هو الانتظام وليس الكثافة.",
            stable_general: "أنت تتقدم. ليس مذهلاً هذا الأسبوع، لكنك تتقدم. وهذا هو المهم.",
            zero: "أسبوع صعب. نبدأ معاً يوم الاثنين. يوم واحد يكفي لإعادة تشغيل الآلة.",
        },
        hi: {
            rising_consistent: "तुम कुछ ठोस बना रहे हो। हर दिन मायने रखता है और यह दिखता है। बिल्कुल ऐसे ही जारी रखो।",
            rising_general: `तुम हफ्ते दर हफ्ते आगे बढ़ रहे हो। ${delta > 0 ? `+${delta} मोमेंटम पॉइंट्स` : ""} — यही ऊर्जा बनाए रखो।`,
            falling_broken: "तुमने अपनी streak तोड़ी लेकिन वापस आए। यही असली अनुशासन है — पूर्णता नहीं, लचीलापन।",
            falling_general: "यह हफ्ता सामान्य से शांत रहा। यह ठीक है। जरूरी है कि एक बुरा हफ्ता दूसरे को न बुलाए।",
            stable_consistent: "तुम घड़ी की तरह नियमित हो। यही लंबे समय के परिणाम बनाता है।",
            stable_irregular: "कुछ दिनों में बहुत मार्क करते हो लेकिन दूसरों में गायब हो जाते हो। राज नियमितता में है, तीव्रता में नहीं।",
            stable_general: "तुम आगे बढ़ रहे हो। इस हफ्ते शानदार नहीं, लेकिन आगे बढ़ रहे हो। और यही मायने रखता है।",
            zero: "मुश्किल हफ्ता। सोमवार को मिलकर फिर शुरू करते हैं। एक दिन ही काफी है मशीन को फिर चालू करने के लिए।",
        },
        zh: {
            rising_consistent: "你正在建立坚实的基础。每一天都有意义，而且看得出来。就这样继续下去。",
            rising_general: `你周复一周地进步着。${delta > 0 ? `+${delta} 动力值` : ""} — 保持这份能量。`,
            falling_broken: "你打破了连胜但又回来了。这才是真正的自律——不是完美，而是韧性。",
            falling_general: "这周比平时轻松一些。这很正常。重要的是不要让一个糟糕的周带出另一个。",
            stable_consistent: "你像时钟一样规律。这正是创造持久成果的方式。",
            stable_irregular: "你在某些天标记很多，但在其他天消失了。秘诀在于规律性，而不是强度。",
            stable_general: "你在前进。这周不算精彩，但你在前进。这才是最重要的。",
            zero: "艰难的一周。周一我们一起重新出发。一天就足以重新启动这台机器。",
        },
        ja: {
            rising_consistent: "あなたは着実に何かを築いています。毎日が積み重なっており、それが見えています。まったくこのまま続けてください。",
            rising_general: `あなたは週を追うごとに成長しています。${delta > 0 ? `+${delta}モメンタムポイント` : ""} — このエネルギーを保ち続けてください。`,
            falling_broken: "ストリークが途切れましたが、また戻ってきました。それが本当の規律です——完璧さではなく、回復力です。",
            falling_general: "今週はいつもより穏やかでした。それは普通のことです。大切なのは、悪い週を次の週に引きずらないことです。",
            stable_consistent: "あなたは時計のように規則正しいです。それがまさに持続的な結果を生み出すものです。",
            stable_irregular: "ある日はたくさん記録するのに、他の日は消えてしまいます。秘訣は強度ではなく、規則性です。",
            stable_general: "あなたは前進しています。今週は派手ではありませんでしたが、前進しています。それが大切です。",
            zero: "大変な一週間でした。月曜日に一緒に再スタートしましょう。機械を再起動するには一日あれば十分です。",
        },
        ko: {
            rising_consistent: "당신은 탄탄한 무언가를 만들고 있습니다. 매일이 중요하고 그게 보입니다. 정확히 이대로 계속하세요.",
            rising_general: `당신은 주마다 발전하고 있습니다. ${delta > 0 ? `+${delta} 모멘텀 포인트` : ""} — 이 에너지를 유지하세요.`,
            falling_broken: "연속 기록이 끊겼지만 다시 돌아왔습니다. 그게 진짜 규율입니다 — 완벽함이 아니라 회복력입니다.",
            falling_general: "이번 주는 평소보다 조용했습니다. 괜찮습니다. 중요한 건 나쁜 한 주가 다음 주까지 이어지지 않게 하는 것입니다.",
            stable_consistent: "당신은 시계처럼 규칙적입니다. 그게 바로 지속적인 결과를 만드는 것입니다.",
            stable_irregular: "어떤 날은 많이 기록하지만 다른 날은 사라집니다. 비결은 강도가 아니라 규칙성입니다.",
            stable_general: "당신은 앞으로 나아가고 있습니다. 이번 주는 화려하지 않았지만 나아가고 있습니다. 그게 중요합니다.",
            zero: "힘든 한 주였습니다. 월요일에 함께 다시 시작합시다. 단 하루면 기계를 다시 작동시키기에 충분합니다.",
        },
        en: {
            rising_consistent: "You're building something solid. Every day counts and it shows. Keep going exactly like this.",
            rising_general: `You're progressing week after week. ${delta > 0 ? `+${delta} momentum points` : ""} — keep that energy.`,
            falling_broken: "You broke your streak but got back on it. That's real discipline — not perfection, resilience.",
            falling_general: "This week was gentler than usual. That's okay. The important thing is not letting one bad week lead to another.",
            stable_consistent: "You're consistent as a clock. That's exactly what creates lasting results.",
            stable_irregular: "You mark a lot on some days but disappear on others. The secret is consistency, not intensity.",
            stable_general: "You're moving forward. Not spectacular this week, but moving forward. And that's what counts.",
            zero: "Tough week. Let's restart together Monday. Just one day is enough to get the machine going again.",
        },
    };
    const l = lang.startsWith("fr") ? "fr" : "en";
    const m = msgs[l];
    if (week0Days === 0)
        return m.zero;
    if (isRising && isConsistent)
        return m.rising_consistent;
    if (isRising)
        return m.rising_general;
    if (isFalling && streakBrokenThisWeek)
        return m.falling_broken;
    if (isFalling)
        return m.falling_general;
    if (isStable && isConsistent)
        return m.stable_consistent;
    if (isStable && isIrregular)
        return m.stable_irregular;
    return m.stable_general;
}
// ── Génère l'objectif semaine suivante ───────────────────────────────────────
function generateGoal(week0Days, weakestDayIndex, lang) {
    const DAY_NAMES_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    const DAY_NAMES_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayNames = lang.startsWith("fr") ? DAY_NAMES_FR : DAY_NAMES_EN;
    // +1 jour si < 6, sinon 7
    const target = Math.min(week0Days + 1, 7);
    const weakDay = weakestDayIndex !== null ? dayNames[weakestDayIndex] : null;
    let message = "";
    if (lang.startsWith("fr")) {
        if (weakDay && week0Days >= 3) {
            message = `Cette semaine : marque au moins ${target} jours — et essaie le ${weakDay}, c'est ton jour le plus faible.`;
        }
        else {
            message = `Cette semaine : marque au moins ${target} jour${target > 1 ? "s" : ""}.`;
        }
    }
    else {
        if (weakDay && week0Days >= 3) {
            message = `This week: mark at least ${target} days — and try ${weakDay}, it's your weakest day.`;
        }
        else {
            message = `This week: mark at least ${target} day${target > 1 ? "s" : ""}.`;
        }
    }
    return { target, weakDay, message };
}
// ── Cloud Function principale ─────────────────────────────────────────────────
exports.sendWeeklyReport = (0, scheduler_1.onSchedule)({
    schedule: "every monday 08:00",
    timeZone: "UTC",
    region: "europe-west1",
}, async () => {
    const now = new Date();
    const thisMonday = getMondayOf(now);
    // Semaine passée = lundi précédent
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const twoWeeksAgo = new Date(thisMonday);
    twoWeeksAgo.setDate(thisMonday.getDate() - 14);
    const threeWeeksAgo = new Date(thisMonday);
    threeWeeksAgo.setDate(thisMonday.getDate() - 21);
    const week0Keys = new Set(getWeekDays(lastMonday)); // semaine passée
    const week1Keys = new Set(getWeekDays(twoWeeksAgo)); // il y a 2 sem
    const week2Keys = new Set(getWeekDays(threeWeeksAgo)); // il y a 3 sem
    const weekId = toDateKey(lastMonday); // clé du rapport = lundi de la semaine passée
    // Cutoff : actif dans les 21 derniers jours
    const cutoff = firestore_1.Timestamp.fromDate(threeWeeksAgo);
    // Récupère tous les users actifs (on filtre via les CurrentChallenges)
    const usersSnap = await db.collection("users")
        .where("updatedAt", ">=", cutoff)
        .get();
    console.log(`[sendWeeklyReport] ${usersSnap.size} users actifs à traiter`);
    const tasks = [];
    for (const userDoc of usersSnap.docs) {
        tasks.push((async () => {
            try {
                const uid = userDoc.id;
                const data = userDoc.data();
                // Déjà envoyé cette semaine ?
                const reportRef = db.collection("users").doc(uid)
                    .collection("weeklyReports").doc(weekId);
                const existing = await reportRef.get();
                if (existing.exists)
                    return;
                const lang = data.language || "fr";
                const fcmToken = data.fcmToken || data.expoPushToken;
                // ── Collecte les completionDates ──────────────────────────────
                const allChallenges = [
                    ...(Array.isArray(data.CurrentChallenges) ? data.CurrentChallenges : []),
                    ...(Array.isArray(data.CompletedChallenges) ? data.CompletedChallenges : []),
                ];
                const dateKeys = [];
                const challengesByDate = {};
                allChallenges.forEach((ch) => {
                    const cid = ch?.challengeId || ch?.id || "unknown";
                    const dates = Array.isArray(ch?.completionDates) ? ch.completionDates : [];
                    dates.forEach((raw) => {
                        let key = "";
                        if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
                            const d = new Date(raw.seconds * 1000);
                            key = toDateKey(d);
                        }
                        else if (typeof raw === "string") {
                            key = raw.slice(0, 10);
                        }
                        if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                            dateKeys.push(key);
                            if (!challengesByDate[key])
                                challengesByDate[key] = new Set();
                            challengesByDate[key].add(cid);
                        }
                    });
                });
                const dateSet = new Set(dateKeys);
                // ── Stats par semaine ─────────────────────────────────────────
                const week0MarkedDays = [...week0Keys].filter(k => dateSet.has(k));
                const week1Days = [...week1Keys].filter(k => dateSet.has(k)).length;
                const week2Days = [...week2Keys].filter(k => dateSet.has(k)).length;
                // Aucune activité dans les 3 semaines → skip
                if (week0MarkedDays.length === 0 && week1Days === 0 && week2Days === 0)
                    return;
                // Défis uniques cette semaine
                const uniqueChallengesThisWeek = new Set(week0MarkedDays.flatMap(k => [...(challengesByDate[k] || [])])).size;
                // Jour le plus faible (moins de marquages cette semaine)
                const dayCount = Array(7).fill(0);
                week0MarkedDays.forEach(k => {
                    const d = new Date(k);
                    const dow = (d.getDay() + 6) % 7;
                    dayCount[dow]++;
                });
                // Jour le plus faible parmi ceux où on a marqué au moins 1 fois dans les 3 sem
                let weakestDayIndex = null;
                let minCount = Infinity;
                dayCount.forEach((c, i) => {
                    if (c < minCount) {
                        minCount = c;
                        weakestDayIndex = i;
                    }
                });
                // Streak cassé cette semaine ?
                const streakBrokenThisWeek = week1Days > 0 && week0MarkedDays.length === 0;
                // ── Scores ───────────────────────────────────────────────────
                const score = computeMomentumScore(week0MarkedDays.length, week1Days, week2Days, uniqueChallengesThisWeek);
                // Score semaine précédente (approximation)
                const prevScore = computeMomentumScore(week1Days, week2Days, week2Days, 1);
                // ── Diagnostic + objectif ─────────────────────────────────────
                const diagnostic = generateDiagnostic(score, prevScore, week0MarkedDays.length, week1Days, streakBrokenThisWeek, lang);
                const goal = generateGoal(week0MarkedDays.length, weakestDayIndex, lang);
                // ── Trophées de la semaine ────────────────────────────────────
                const weeklyTrophies = Array.isArray(data.weeklyTrophies)
                    ? (data.weeklyTrophies.slice(-1)[0] || 0)
                    : 0;
                // ── Sauvegarde du rapport ─────────────────────────────────────
                const report = {
                    weekId,
                    createdAt: firestore_1.Timestamp.now(),
                    score,
                    prevScore,
                    delta: score - prevScore,
                    markedDays: week0MarkedDays.length,
                    trophiesThisWeek: weeklyTrophies,
                    diagnostic,
                    goal: goal.message,
                    goalTarget: goal.target,
                    goalWeakDay: goal.weakDay,
                    seen: false,
                };
                await reportRef.set(report);
                // ── Notification push ─────────────────────────────────────────
                if (!fcmToken)
                    return;
                const notifTitle = lang.startsWith("fr")
                    ? `Ton bilan de la semaine 📊`
                    : `Your weekly report 📊`;
                const notifBody = lang.startsWith("fr")
                    ? `Score momentum : ${score}/100 · ${week0MarkedDays.length} jours actifs`
                    : `Momentum score: ${score}/100 · ${week0MarkedDays.length} active days`;
                await (0, messaging_1.getMessaging)().send({
                    token: fcmToken,
                    notification: { title: notifTitle, body: notifBody },
                    data: {
                        type: "weekly_report",
                        weekId,
                        score: String(score),
                    },
                    apns: {
                        payload: { aps: { sound: "default", badge: 1 } },
                    },
                    android: {
                        notification: { sound: "default", channelId: "default" },
                    },
                });
                console.log(`[sendWeeklyReport] ✅ ${uid} → score=${score}, days=${week0MarkedDays.length}`);
            }
            catch (err) {
                console.error(`[sendWeeklyReport] ❌ ${userDoc.id}:`, err);
            }
        })());
    }
    await Promise.allSettled(tasks);
});
