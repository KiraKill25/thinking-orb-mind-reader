import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const turn = z.object({
  kind: z.enum(["question", "guess"]),
  text: z.string().max(300),
  answer: z.string().max(40),
});

const ctx = {
  lang: z.enum(["ar", "fr", "en"]),
  latin: z.boolean(),
  table: z.string().max(20).nullable(),
  items: z.array(z.string().max(80)).max(30),
};

export const orbNextTurn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      history: z.array(turn).max(60),
      wrongGuesses: z.array(z.string().max(200)).max(20),
      questionsAsked: z.number().int().min(0).max(40),
      ...ctx,
    }),
  )
  .handler(async ({ data }) => {
    const { nextTurn } = await import("./orb.server");
    return nextTurn(data);
  });

export const orbJoker = createServerFn({ method: "POST" })
  .validator(z.object({ history: z.array(turn).max(60), question: z.string().min(1).max(300), ...ctx }))
  .handler(async ({ data }) => {
    const { jokerAnswer } = await import("./orb.server");
    return { text: await jokerAnswer(data) };
  });
