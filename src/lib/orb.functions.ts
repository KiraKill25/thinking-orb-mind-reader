import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const turn = z.object({
  kind: z.enum(["question", "guess"]),
  text: z.string().max(300),
  answer: z.string().max(40),
});

export const orbNextTurn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      history: z.array(turn).max(60),
      wrongGuesses: z.array(z.string().max(200)).max(20),
      questionsAsked: z.number().int().min(0).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const { nextTurn } = await import("./orb.server");
    return nextTurn(data.history, data.wrongGuesses, data.questionsAsked);
  });

export const orbJoker = createServerFn({ method: "POST" })
  .inputValidator(z.object({ history: z.array(turn).max(60), question: z.string().min(1).max(300) }))
  .handler(async ({ data }) => {
    const { jokerAnswer } = await import("./orb.server");
    return { text: await jokerAnswer(data.history, data.question) };
  });
