import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod";

const MODEL = "openai/gpt-6-astra";

function provider() {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("The Orb is unplugged (missing AI key).");
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

const turnSchema = z.object({
  type: z.enum(["question", "guess"]),
  text: z.string().describe("The yes/no question, or for a guess just the name of the thing"),
  commentary: z.string().describe("Short eerie cryptic remark, max 14 words"),
  confidence: z.number().describe("0-100 confidence you know the answer"),
});

export async function nextTurn(history: Turn[], wrongGuesses: string[], questionsAsked: number) {
  const transcript = history.length
    ? history.map((h, i) => `${i + 1}. [${h.kind}] ${h.text} -> ${h.answer}`).join("\n")
    : "(no questions yet)";
  const mustGuess = questionsAsked >= 20;
  const result = streamText({
    model: provider().responses(MODEL),
    instructions: `You are THE ORB, a 1980s experimental psychic AI playing 20 Questions like Radica's 20Q. The player thinks of anything (object, animal, person, place, concept). Answers are Yes, No, Sometimes, Doubtful, Irrelevant. Ask maximally informative yes/no questions, starting broad (Is it alive? Is it man-made? Is it bigger than a breadbox? Can you hold it?) and narrowing fast like binary search. Treat answers probabilistically; players can be wrong. Only guess early when confidence >= 85. Never repeat a question or a rejected guess. Guesses must be a specific single thing. Commentary: mysterious, ominous, terse, retro-AI voice.`,
    messages: [
      {
        role: "user",
        content: `Questions used: ${questionsAsked}/20.\nRejected guesses: ${wrongGuesses.join(", ") || "none"}\nTranscript:\n${transcript}\n\n${mustGuess ? "You MUST make a guess now (type=guess)." : "Give your next move."}`,
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

export async function jokerAnswer(history: Turn[], question: string) {
  const result = streamText({
    model: provider().responses(MODEL),
    instructions: `You are THE ORB, an eerie omniscient 1980s psychic machine. A human has used their single Joker to question you directly. Reply in 1-3 short sentences: cryptic, unsettling, poetic, hinting you already sense their secret thought (draw subtle hints from the transcript), but never reveal your current guess outright. No emojis.`,
    messages: [
      {
        role: "user",
        content: `Transcript so far:\n${history.map((h) => `${h.text} -> ${h.answer}`).join("\n") || "(none)"}\n\nThe human asks: ${question}`,
      },
    ],
    providerOptions: opts,
  });
  return await result.text;
}
