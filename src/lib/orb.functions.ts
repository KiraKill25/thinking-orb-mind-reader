import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EXPIRED_MSG, remainingMs } from "./session";

function guard(d: { ts?: number; ttl?: number }) {
  if (remainingMs(d.ts, d.ttl) <= 0) throw new Error(EXPIRED_MSG);
}

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
  ts: z.number().optional(),
  ttl: z.number().optional(),
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
    guard(data);
    const { nextTurn } = await import("./orb.server");
    return nextTurn(data);
  });

export const orbJoker = createServerFn({ method: "POST" })
  .validator(z.object({ history: z.array(turn).max(60), question: z.string().min(1).max(300), ...ctx }))
  .handler(async ({ data }) => {
    guard(data);
    const { jokerAnswer } = await import("./orb.server");
    return { text: await jokerAnswer(data) };
  });
