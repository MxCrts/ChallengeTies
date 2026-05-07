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
// ── Génère weekLabel localisé ─────────────────────────────────────────────────
function formatWeekLabel(mondayDate, lang) {
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);
    const locale = lang === "fr" ? "fr-FR" :
        lang === "de" ? "de-DE" :
            lang === "es" ? "es-ES" :
                lang === "it" ? "it-IT" :
                    lang === "pt" ? "pt-PT" :
                        lang === "nl" ? "nl-NL" :
                            lang === "ru" ? "ru-RU" :
                                lang === "ar" ? "ar-SA" :
                                    lang === "hi" ? "hi-IN" :
                                        lang === "zh" ? "zh-CN" :
                                            lang === "ja" ? "ja-JP" :
                                                lang === "ko" ? "ko-KR" :
                                                    "en-US";
    const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
    return `${fmt.format(mondayDate)} – ${fmt.format(sunday)}`;
}
// ── Calcul momentum score ─────────────────────────────────────────────────────
// FIX: si 0 jours cette semaine → score max 15 (présence passée donne un petit bonus)
function computeMomentumScore(week0Days, week1Days, week2Days, uniqueChallenges) {
    // Régularité (50%) — pondéré plus fort, base réelle de la semaine
    const regularity = Math.min(week0Days / 7, 1) * 50;
    // Tendance (30%) — seulement si on a marqué cette semaine
    let trendScore = 0;
    if (week0Days > 0) {
        const avg12 = (week1Days + week2Days) / 2 || 1;
        const trend = Math.min(Math.max(week0Days / avg12, 0), 2);
        trendScore = (trend / 2) * 30;
    }
    // Intensité (20%) — nombre de défis différents, seulement si actif
    const intensity = week0Days > 0 ? Math.min(uniqueChallenges / 3, 1) * 20 : 0;
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
    // FIX: sélection de langue correcte — toutes les 13 langues
    const l = lang === "fr" ? "fr" :
        lang === "de" ? "de" :
            lang === "es" ? "es" :
                lang === "it" ? "it" :
                    lang === "pt" ? "pt" :
                        lang === "nl" ? "nl" :
                            lang === "ru" ? "ru" :
                                lang === "ar" ? "ar" :
                                    lang === "hi" ? "hi" :
                                        lang === "zh" ? "zh" :
                                            lang === "ja" ? "ja" :
                                                lang === "ko" ? "ko" :
                                                    "en";
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
            falling_broken: "Quebraste a tua série mas voltaste. Isso é a verdadeira disciplina — não a perfeição, a resiliência.",
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
    const m = msgs[l] ?? msgs["en"];
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
    const DAY_NAMES = {
        fr: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
        de: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
        es: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"],
        it: ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"],
        pt: ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"],
        nl: ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"],
        ru: ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"],
        ar: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
        hi: ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"],
        zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        ja: ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"],
        ko: ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"],
        en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    };
    const l = lang === "fr" ? "fr" :
        lang === "de" ? "de" :
            lang === "es" ? "es" :
                lang === "it" ? "it" :
                    lang === "pt" ? "pt" :
                        lang === "nl" ? "nl" :
                            lang === "ru" ? "ru" :
                                lang === "ar" ? "ar" :
                                    lang === "hi" ? "hi" :
                                        lang === "zh" ? "zh" :
                                            lang === "ja" ? "ja" :
                                                lang === "ko" ? "ko" :
                                                    "en";
    const dayNames = DAY_NAMES[l] ?? DAY_NAMES["en"];
    const target = Math.min(week0Days + 1, 7);
    const weakDay = weakestDayIndex !== null ? dayNames[weakestDayIndex] : null;
    const GOAL_MSGS = {
        fr: (t, w) => w && week0Days >= 3
            ? `Cette semaine : marque au moins ${t} jour${t > 1 ? "s" : ""} — et essaie le ${w}, c'est ton jour le plus faible.`
            : `Cette semaine : marque au moins ${t} jour${t > 1 ? "s" : ""}.`,
        de: (t, w) => w && week0Days >= 3
            ? `Diese Woche: mindestens ${t} Tag${t > 1 ? "e" : ""} markieren — und versuche es am ${w}, das ist dein schwächster Tag.`
            : `Diese Woche: mindestens ${t} Tag${t > 1 ? "e" : ""} markieren.`,
        es: (t, w) => w && week0Days >= 3
            ? `Esta semana: marca al menos ${t} día${t > 1 ? "s" : ""} — e intenta el ${w}, es tu día más débil.`
            : `Esta semana: marca al menos ${t} día${t > 1 ? "s" : ""}.`,
        it: (t, w) => w && week0Days >= 3
            ? `Questa settimana: segna almeno ${t} giorn${t > 1 ? "i" : "o"} — e prova il ${w}, è il tuo giorno più debole.`
            : `Questa settimana: segna almeno ${t} giorn${t > 1 ? "i" : "o"}.`,
        pt: (t, w) => w && week0Days >= 3
            ? `Esta semana: marca pelo menos ${t} dia${t > 1 ? "s" : ""} — e tenta a ${w}, é o teu dia mais fraco.`
            : `Esta semana: marca pelo menos ${t} dia${t > 1 ? "s" : ""}.`,
        nl: (t, w) => w && week0Days >= 3
            ? `Deze week: markeer minimaal ${t} dag${t > 1 ? "en" : ""} — en probeer op ${w}, dat is je zwakste dag.`
            : `Deze week: markeer minimaal ${t} dag${t > 1 ? "en" : ""}.`,
        ru: (t, w) => w && week0Days >= 3
            ? `На этой неделе: отметь хотя бы ${t} ${t === 1 ? "день" : t < 5 ? "дня" : "дней"} — и попробуй в ${w}, это твой самый слабый день.`
            : `На этой неделе: отметь хотя бы ${t} ${t === 1 ? "день" : t < 5 ? "дня" : "дней"}.`,
        ar: (t, w) => w && week0Days >= 3
            ? `هذا الأسبوع: سجّل ${t} ${t === 1 ? "يوماً" : "أيام"} على الأقل — وحاول يوم ${w}، هو يومك الأضعف.`
            : `هذا الأسبوع: سجّل ${t} ${t === 1 ? "يوماً" : "أيام"} على الأقل.`,
        hi: (t, w) => w && week0Days >= 3
            ? `इस हफ्ते: कम से कम ${t} दिन मार्क करो — और ${w} को जरूर करो, यह तुम्हारा सबसे कमजोर दिन है।`
            : `इस हफ्ते: कम से कम ${t} दिन मार्क करो।`,
        zh: (t, w) => w && week0Days >= 3
            ? `本周：至少标记 ${t} 天 — 试着在${w}也完成，那是你最薄弱的一天。`
            : `本周：至少标记 ${t} 天。`,
        ja: (t, w) => w && week0Days >= 3
            ? `今週：少なくとも${t}日マークしましょう — ${w}も試してみてください、最も弱い日です。`
            : `今週：少なくとも${t}日マークしましょう。`,
        ko: (t, w) => w && week0Days >= 3
            ? `이번 주: 최소 ${t}일 표시하세요 — ${w}도 시도해보세요, 가장 약한 날입니다.`
            : `이번 주: 최소 ${t}일 표시하세요.`,
        en: (t, w) => w && week0Days >= 3
            ? `This week: mark at least ${t} day${t > 1 ? "s" : ""} — and try ${w}, it's your weakest day.`
            : `This week: mark at least ${t} day${t > 1 ? "s" : ""}.`,
    };
    const fn = GOAL_MSGS[l] ?? GOAL_MSGS["en"];
    const message = fn(target, weakDay);
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
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const twoWeeksAgo = new Date(thisMonday);
    twoWeeksAgo.setDate(thisMonday.getDate() - 14);
    const threeWeeksAgo = new Date(thisMonday);
    threeWeeksAgo.setDate(thisMonday.getDate() - 21);
    const week0Keys = new Set(getWeekDays(lastMonday));
    const week1Keys = new Set(getWeekDays(twoWeeksAgo));
    const week2Keys = new Set(getWeekDays(threeWeeksAgo));
    const weekId = toDateKey(lastMonday);
    const cutoff = firestore_1.Timestamp.fromDate(threeWeeksAgo);
    const usersSnap = await db.collection("users")
        .where("updatedAt", ">=", cutoff)
        .get();
    console.log(`[sendWeeklyReport] ${usersSnap.size} users à traiter`);
    const tasks = [];
    for (const userDoc of usersSnap.docs) {
        tasks.push((async () => {
            try {
                const uid = userDoc.id;
                const data = userDoc.data();
                const reportRef = db.collection("users").doc(uid)
                    .collection("weeklyReports").doc(weekId);
                const existing = await reportRef.get();
                if (existing.exists)
                    return;
                const lang = (data.language || "fr").split("-")[0]; // normalise "fr-FR" → "fr"
                const fcmToken = data.fcmToken || data.expoPushToken;
                // ── Collecte les completionDates ──────────────────────────────
                const allChallenges = [
                    ...(Array.isArray(data.CurrentChallenges) ? data.CurrentChallenges : []),
                    ...(Array.isArray(data.CompletedChallenges) ? data.CompletedChallenges : []),
                ];
                const dateKeys = [];
                const challengesByDate = {};
                // Stats par challenge pour le rapport
                const challengeStatsMap = {};
                allChallenges.forEach((ch) => {
                    const cid = ch?.challengeId || ch?.id || "unknown";
                    const dates = Array.isArray(ch?.completionDates) ? ch.completionDates : [];
                    // Stats challenge
                    const markedThisWeek = dates.filter((raw) => {
                        let key = "";
                        if (raw && typeof raw === "object" && typeof raw.seconds === "number") {
                            key = toDateKey(new Date(raw.seconds * 1000));
                        }
                        else if (typeof raw === "string") {
                            key = raw.slice(0, 10);
                        }
                        return week0Keys.has(key);
                    }).length;
                    if (!challengeStatsMap[cid]) {
                        challengeStatsMap[cid] = {
                            title: ch?.title || ch?.chatId || cid,
                            category: ch?.category || "",
                            markedThisWeek,
                            totalDays: ch?.selectedDays || 0,
                            completedDays: ch?.completedDays || 0,
                            streak: ch?.streak || 0,
                            isDuo: ch?.duo === true,
                            partnerName: ch?.partnerName || undefined,
                            partnerMarkedThisWeek: undefined,
                        };
                    }
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
                // markedDaysBits [L,M,M,J,V,S,D]
                const markedDaysBits = Array(7).fill(false);
                week0MarkedDays.forEach(k => {
                    const d = new Date(k);
                    const dow = (d.getDay() + 6) % 7;
                    markedDaysBits[dow] = true;
                });
                // Défis uniques cette semaine
                const uniqueChallengesThisWeek = new Set(week0MarkedDays.flatMap(k => [...(challengesByDate[k] || [])])).size;
                // Jour le plus faible
                const dayCount = Array(7).fill(0);
                week0MarkedDays.forEach(k => {
                    const d = new Date(k);
                    const dow = (d.getDay() + 6) % 7;
                    dayCount[dow]++;
                });
                let weakestDayIndex = null;
                let minCount = Infinity;
                dayCount.forEach((c, i) => {
                    if (c < minCount) {
                        minCount = c;
                        weakestDayIndex = i;
                    }
                });
                const streakBrokenThisWeek = week1Days > 0 && week0MarkedDays.length === 0;
                // ── Scores ───────────────────────────────────────────────────
                const score = computeMomentumScore(week0MarkedDays.length, week1Days, week2Days, uniqueChallengesThisWeek);
                const prevScore = computeMomentumScore(week1Days, week2Days, week2Days, 1);
                // ── Diagnostic + objectif ─────────────────────────────────────
                const diagnostic = generateDiagnostic(score, prevScore, week0MarkedDays.length, week1Days, streakBrokenThisWeek, lang);
                const goal = generateGoal(week0MarkedDays.length, weakestDayIndex, lang);
                // ── weekLabel localisé ────────────────────────────────────────
                const weekLabel = formatWeekLabel(lastMonday, lang);
                // ── Trophées de la semaine ────────────────────────────────────
                const weeklyTrophies = Array.isArray(data.weeklyTrophies)
                    ? (data.weeklyTrophies.slice(-1)[0] || 0)
                    : 0;
                // ── Best streak cette semaine ─────────────────────────────────
                const bestStreak = Math.max(0, ...Object.values(challengeStatsMap).map(c => c.streak || 0));
                // ── Challenges pour le rapport ────────────────────────────────
                const challenges = Object.entries(challengeStatsMap)
                    .filter(([, c]) => c.markedThisWeek > 0 || c.completedDays > 0)
                    .map(([id, c]) => ({ id, ...c }));
                // ── Sauvegarde du rapport — champs alignés avec WeeklyReportData ─
                const report = {
                    weekId,
                    weekLabel,
                    createdAt: firestore_1.Timestamp.now(),
                    score,
                    prevScore,
                    delta: score - prevScore,
                    totalMarked: week0MarkedDays.length,
                    trophiesThisWeek: weeklyTrophies,
                    bestStreak,
                    markedDaysBits,
                    challenges,
                    diagnostic,
                    weekGoal: goal.message, // FIX: weekGoal (pas goal)
                    weekGoalTarget: goal.target, // FIX: weekGoalTarget (pas goalTarget)
                    goalWeakDay: goal.weakDay,
                    seen: false,
                };
                await reportRef.set(report);
                // ── Notification push ─────────────────────────────────────────
                if (!fcmToken)
                    return;
                const NOTIF = {
                    fr: { title: "Ton bilan de la semaine 📊", body: (s, d) => `Score momentum : ${s}/100 · ${d} jour${d > 1 ? "s" : ""} actif${d > 1 ? "s" : ""}` },
                    de: { title: "Dein Wochenbericht 📊", body: (s, d) => `Momentum-Score: ${s}/100 · ${d} aktive${d > 1 ? "" : "r"} Tag${d > 1 ? "e" : ""}` },
                    es: { title: "Tu informe semanal 📊", body: (s, d) => `Puntuación momentum: ${s}/100 · ${d} día${d > 1 ? "s" : ""} activo${d > 1 ? "s" : ""}` },
                    it: { title: "Il tuo report settimanale 📊", body: (s, d) => `Score momentum: ${s}/100 · ${d} giorn${d > 1 ? "i" : "o"} attiv${d > 1 ? "i" : "o"}` },
                    pt: { title: "O teu relatório semanal 📊", body: (s, d) => `Score momentum: ${s}/100 · ${d} dia${d > 1 ? "s" : ""} ativo${d > 1 ? "s" : ""}` },
                    nl: { title: "Jouw wekelijks rapport 📊", body: (s, d) => `Momentumscore: ${s}/100 · ${d} actieve dag${d > 1 ? "en" : ""}` },
                    ru: { title: "Твой недельный отчёт 📊", body: (s, d) => `Моментум: ${s}/100 · ${d} активн${d === 1 ? "ый день" : d < 5 ? "ых дня" : "ых дней"}` },
                    ar: { title: "تقريرك الأسبوعي 📊", body: (s, d) => `نقاط الزخم: ${s}/100 · ${d} ${d === 1 ? "يوم نشط" : "أيام نشطة"}` },
                    hi: { title: "तुम्हारी साप्ताहिक रिपोर्ट 📊", body: (s, d) => `मोमेंटम स्कोर: ${s}/100 · ${d} सक्रिय दिन` },
                    zh: { title: "你的每周报告 📊", body: (s, d) => `动力分数：${s}/100 · ${d} 天活跃` },
                    ja: { title: "週次レポート 📊", body: (s, d) => `モメンタムスコア：${s}/100 · ${d}日間アクティブ` },
                    ko: { title: "주간 보고서 📊", body: (s, d) => `모멘텀 점수: ${s}/100 · ${d}일 활성` },
                    en: { title: "Your weekly report 📊", body: (s, d) => `Momentum score: ${s}/100 · ${d} active day${d > 1 ? "s" : ""}` },
                };
                const notif = NOTIF[lang] ?? NOTIF["en"];
                await (0, messaging_1.getMessaging)().send({
                    token: fcmToken,
                    notification: {
                        title: notif.title,
                        body: notif.body(score, week0MarkedDays.length),
                    },
                    data: { type: "weekly_report", weekId, score: String(score) },
                    apns: { payload: { aps: { sound: "default", badge: 1 } } },
                    android: { notification: { sound: "default", channelId: "default" } },
                });
                console.log(`[sendWeeklyReport] ✅ ${uid} → score=${score}, days=${week0MarkedDays.length}, lang=${lang}`);
            }
            catch (err) {
                console.error(`[sendWeeklyReport] ❌ ${userDoc.id}:`, err);
            }
        })());
    }
    await Promise.allSettled(tasks);
});
