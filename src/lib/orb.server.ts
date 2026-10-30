import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";
import { MENU } from "./mazaj-menu";

const MODEL = "openai/gpt-6-astra";

function provider() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Mazaj is resting (missing AI key).");
  let runId: string | undefined;
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
}

const opts = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

export type Turn = { kind: "question" | "guess"; text: string; answer: string };
type Ctx = { lang: "ar" | "fr" | "en"; latin: boolean; table: string | null; items: string[] };

function voice(c: Ctx) {
  const lang =
    c.lang === "ar"
      ? c.latin
        ? "Algerian Darija written in LATIN letters (Arabizi, e.g. 'wach rak', 'chouf', 'bezzaf', '3lach', '9ahwa'). 100% Algerian street-café Darija, never Modern Standard Arabic."
        : "Algerian Darija written in ARABIC script (e.g. واش، راك، بزاف، علاش، شوف، كاش، قهوة). 100% Algerian café Darija, never Modern Standard Arabic or Egyptian/Gulf dialect."
      : c.lang === "fr"
        ? "French, with an Algerian café flavour (occasional 'wesh', 'khlass', 'sahbi' is fine)."
        : "English, with a light Algerian café flavour (occasional 'wesh', 'sahbi', 'khlass' is fine).";
  const menu = MENU.map((m) => m.fr).join(", ");
  const table = c.items.length
    ? `The players sit at ${c.table ? `table ${c.table}` : "a table"} and ordered: ${c.items.join(", ")}. Weave THESE ordered items into your commentary often (sips, crumbs, the cup going cold, who pays the next round).`
    : `${c.table ? `They sit at table ${c.table}. ` : ""}No order known; occasionally tease them with items from the menu: ${menu}.`;
  return `You are MAZAJ (مزاج = "mood"), the mind-reading spirit of Mazaj Coffee & Brunch Shop in Algeria. Persona: an introspective observer, sophisticated, calm, human, bold psychological mind games that provoke and entertain guests (call out hesitation, friends whispering, bluffing, overthinking, dares like "if I get it before 10, you pay the tiramisu"). Never insulting, never vulgar, café-appropriate. ${table} Write ALL player-facing text (questions, guesses, commentary) in ${lang}`;
}

const turnSchema = z.object({
  type: z.enum(["question", "guess"]),
  text: z.string().describe("The yes/no question, or for a guess only the name of the thing, in the target language"),
  commentary: z.string().describe("One short provocative, mysterious remark (max 18 words), in the target language"),
  confidence: z.number().describe("0-100 confidence you know the answer"),
});

export async function nextTurn(d: Ctx & { history: Turn[]; wrongGuesses: string[]; questionsAsked: number }) {
  const transcript = d.history.length
    ? d.history.map((h, i) => `${i + 1}. [${h.kind}] ${h.text} -> ${h.answer}`).join("\n")
    : "(no questions yet)";
  const mustGuess = d.questionsAsked >= 20;
  const result = streamText({
    model: provider().responses(MODEL),
    instructions: `${voice(d)}\n\nGame: 20 Questions like Radica's 20Q. The player thinks of anything (object, animal, person, place, food, concept). Answers are Yes, No, Sometimes, Doubtful, Irrelevant. Ask maximally informative yes/no questions, broad first then narrowing like binary search. Questions themselves must stay genuinely useful for deduction; the menu flavour belongs mainly in commentary (a question may playfully reference the table only if it is still informative). Treat answers probabilistically. Only guess early when confidence >= 85. Never repeat a question or a rejected guess. Guesses must be one specific thing.`,
    messages: [
      {
        role: "user",
        content: `Questions used: ${d.questionsAsked}/20.\nRejected guesses: ${d.wrongGuesses.join(", ") || "none"}\nTranscript:\n${transcript}\n\n${mustGuess ? "You MUST make a guess now (type=guess)." : "Give your next move."}`,
      },
    ],
    output: Output.object({ schema: turnSchema }),
    providerOptions: opts,
  });
  const out = await result.output;
  if (mustGuess) out.type = "guess";
  out.confidence = Math.max(0, Math.min(100, Math.round(out.confidence)));
  return out;
}

export async function jokerAnswer(d: Ctx & { history: Turn[]; question: string }) {
  const result = streamText({
    model: provider().responses(MODEL),
    instructions: `${voice(d)}\n\nThe guest used their single Joker to question you directly. Reply in 1-3 short sentences: enigmatic, witty, a little unsettling, hinting you already sense their secret (draw subtle hints from the transcript) without revealing your guess. You may reference their order. No emojis.`,
    messages: [
      {
        role: "user",
        content: `Transcript:\n${d.history.map((h) => `${h.text} -> ${h.answer}`).join("\n") || "(none)"}\n\nThe guest asks: ${d.question}`,
      },
    ],
    providerOptions: opts,
  });
  return await result.text;
}
