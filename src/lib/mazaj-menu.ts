export type Lang = "ar" | "fr" | "en";
export type MenuItem = { id: string; fr: string; en: string; ar: string; price: number; cat: "hot" | "cold" | "sweet" };

export const MENU: MenuItem[] = [
  { id: "espresso", fr: "Espresso", en: "Espresso", ar: "إسبريسو", price: 200, cat: "hot" },
  { id: "spanish_late", fr: "Spanish laté", en: "Spanish latte", ar: "سبانيش لاتيه", price: 350, cat: "hot" },
  { id: "macchiato", fr: "Macchiato", en: "Macchiato", ar: "ماكياتو", price: 350, cat: "hot" },
  { id: "cappuccino", fr: "Cappuccino", en: "Cappuccino", ar: "كابوتشينو", price: 250, cat: "hot" },
  { id: "chocolat_chaud", fr: "Chocolat chaud", en: "Hot chocolate", ar: "شوكولا سخونة", price: 300, cat: "hot" },
  { id: "capsule", fr: "Capsule", en: "Capsule coffee", ar: "قهوة كبسولة", price: 200, cat: "hot" },
  { id: "the_maison", fr: "Thé maison", en: "House tea", ar: "أتاي الدار", price: 150, cat: "hot" },
  { id: "turkish_tea", fr: "Turkish tea", en: "Turkish tea", ar: "شاي تركي", price: 150, cat: "hot" },
  { id: "tizane", fr: "Tizane infusion", en: "Herbal infusion", ar: "تيزان", price: 150, cat: "hot" },
  { id: "milkshake", fr: "Milkshake", en: "Milkshake", ar: "ميلك شيك", price: 500, cat: "cold" },
  { id: "froppucino", fr: "Froppucino", en: "Frappuccino", ar: "فرابوتشينو", price: 450, cat: "cold" },
  { id: "mojito_classic", fr: "Mojito classic", en: "Classic mojito", ar: "موهيتو كلاسيك", price: 350, cat: "cold" },
  { id: "mojito_hawai", fr: "Mojito hawaï", en: "Hawaiian mojito", ar: "موهيتو هاواي", price: 450, cat: "cold" },
  { id: "jus_orange", fr: "Jus orange frais", en: "Fresh orange juice", ar: "عصير تشينة", price: 300, cat: "cold" },
  { id: "jus_fraise", fr: "Jus fraise", en: "Strawberry juice", ar: "عصير فريز", price: 400, cat: "cold" },
  { id: "jus_noisette", fr: "Jus noisette", en: "Hazelnut shake", ar: "عصير البندق", price: 500, cat: "cold" },
  { id: "citronade", fr: "Citronade", en: "Lemonade", ar: "سيتروناد", price: 350, cat: "cold" },
  { id: "gaufres", fr: "Gaufres", en: "Waffles", ar: "غوفر", price: 500, cat: "sweet" },
  { id: "crepes_chocolat", fr: "Crêpes chocolat", en: "Chocolate crêpes", ar: "كريب شوكولا", price: 350, cat: "sweet" },
  { id: "crepes_fruits", fr: "Crêpes fruits", en: "Fruit crêpes", ar: "كريب فواكه", price: 450, cat: "sweet" },
  { id: "tiramisu", fr: "Tiramisu", en: "Tiramisu", ar: "تيراميسو", price: 300, cat: "sweet" },
  { id: "cheesecake_oreo", fr: "Cheese cake oreo", en: "Oreo cheesecake", ar: "تشيز كيك أوريو", price: 450, cat: "sweet" },
  { id: "yumburger", fr: "Yumburger", en: "Yumburger", ar: "يمبرغر", price: 650, cat: "sweet" },
  { id: "morceaux_gourmands", fr: "Morceaux gourmands", en: "Gourmet bites", ar: "قطع غورمون", price: 350, cat: "sweet" },
  { id: "mousse_chocolat", fr: "Mousse chocolat", en: "Chocolate mousse", ar: "موس شوكولا", price: 450, cat: "sweet" },
  { id: "creme_brulee", fr: "Crème brûlée", en: "Crème brûlée", ar: "كريم بروليه", price: 500, cat: "sweet" },
  { id: "tartelettes", fr: "Les tartelettes", en: "Tartlets", ar: "تارتليت", price: 250, cat: "sweet" },
  { id: "brownies_chocolat", fr: "Brownies chocolat", en: "Chocolate brownies", ar: "براونيز شوكولا", price: 250, cat: "sweet" },
  { id: "brownies_caramel", fr: "Brownies caramel/pistache", en: "Caramel/pistachio brownies", ar: "براونيز كراميل/فستق", price: 300, cat: "sweet" },
  { id: "cheesecake_fruit_rouge", fr: "Cheese cake fruit rouge", en: "Red-berry cheesecake", ar: "تشيز كيك فواكه حمراء", price: 500, cat: "sweet" },
  { id: "cheesecake_speculoos", fr: "Cheese cake speculoos", en: "Speculoos cheesecake", ar: "تشيز كيك سبيكولوس", price: 500, cat: "sweet" },
  { id: "cheesecake_pistache", fr: "Cheese cake pistache", en: "Pistachio cheesecake", ar: "تشيز كيك فستق", price: 550, cat: "sweet" },
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, "");

/** Accepts ids or names (FR/EN/AR), comma separated, optional "2x" / "x2" quantity. */
export function parseOrder(raw: string): MenuItem[] {
  const out: MenuItem[] = [];
  for (const part of raw.split(/[,;|]/)) {
    const key = norm(part.replace(/^\s*\d+\s*x\s*|\s*x\s*\d+\s*$/i, ""));
    if (!key) continue;
    const hit = MENU.find((m) => [m.id, m.fr, m.en, m.ar].some((n) => norm(n) === key));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

export const ANSWER_KEYS = ["Yes", "No", "Sometimes", "Doubtful", "Irrelevant"] as const;

export const T = {
  en: {
    title: "Mind Reader", tagline: "Think of anything. Anything at all.", sub: "I'll find it in twenty questions or fewer.",
    start: "I have it in mind", again: "Play again", retry: "Try again", q: "Question", vision: "My guess",
    areYou: "You're thinking of…", right: "That's it", wrong: "Not quite", thinking: "Reading you",
    won: "Your mind has been read", inN: (n: number) => `Read in ${n} questions.`,
    lost: "You win this round", lostSub: "Your mind is well guarded. Mazaj tips its cup to you.",
    joker: "Ask Mazaj — once per game", jokerPh: "Ask Mazaj anything…", ask: "Ask", youAsked: "You asked",
    log: "The conversation", lock: "Certainty", sound: "Sound", table: "Table", menu: "Menu",
    answers: { Yes: "Yes", No: "No", Sometimes: "Sometimes", Doubtful: "Doubtful", Irrelevant: "Irrelevant" },
    hot: "Hot drinks", cold: "Cold drinks", sweet: "Sweets", hours: "Sat–Thu 09h–20h · Fri 14h–21h",
  },
  fr: {
    title: "Le Liseur d'Esprit", tagline: "Pensez à quelque chose. N'importe quoi.", sub: "Je le trouverai en vingt questions ou moins.",
    start: "J'y pense", again: "Rejouer", retry: "Réessayer", q: "Question", vision: "Ma réponse",
    areYou: "Vous pensez à…", right: "C'est ça", wrong: "Pas tout à fait", thinking: "Je vous lis",
    won: "Votre esprit a été lu", inN: (n: number) => `Lu en ${n} questions.`,
    lost: "Vous gagnez cette manche", lostSub: "Votre esprit est bien gardé. Mazaj lève sa tasse.",
    joker: "Interroger Mazaj — une fois", jokerPh: "Demandez ce que vous voulez…", ask: "Demander", youAsked: "Votre question",
    log: "La conversation", lock: "Certitude", sound: "Son", table: "Table", menu: "Carte",
    answers: { Yes: "Oui", No: "Non", Sometimes: "Parfois", Doubtful: "Douteux", Irrelevant: "Hors sujet" },
    hot: "Boissons chaudes", cold: "Boissons froides", sweet: "Nos sucrés", hours: "Sam–Jeu 09h–20h · Ven 14h–21h",
  },
  ar: {
    title: "قارئ المزاج", tagline: "خمّم في حاجة. أي حاجة.", sub: "نلقاها في عشرين سؤال ولا أقل.",
    start: "راني خمّمت", again: "نعاودو", retry: "عاود", q: "سؤال", vision: "تخمينتي",
    areYou: "راك تخمم في…", right: "هي هيا", wrong: "ماشي هي", thinking: "راني نقرا فيك",
    won: "قريت مخك", inN: (n: number) => `في ${n} أسئلة برك.`,
    lost: "غلبتني هاد المرة", lostSub: "مخك مسكّر مليح. مزاج يرفعلك الكاس.",
    joker: "اسأل مزاج — مرة وحدة", jokerPh: "اسأل مزاج واش تحب…", ask: "اسأل", youAsked: "سقسيت",
    log: "الهدرة", lock: "اليقين", sound: "الصوت", table: "طاولة", menu: "المنيو",
    answers: { Yes: "إيه", No: "لا", Sometimes: "ساعات", Doubtful: "ما نظنش", Irrelevant: "ما عندها علاقة" },
    hot: "مشروبات سخونة", cold: "مشروبات باردة", sweet: "الحلويات", hours: "السبت–الخميس 09–20 · الجمعة 14–21",
  },
};

export const LATIN_ANSWERS = { Yes: "Ih", No: "La", Sometimes: "Sa3at", Doubtful: "Ma ndonnch", Irrelevant: "Ma 3andha 3ala9a" };
