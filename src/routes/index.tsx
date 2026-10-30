import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { orbJoker, orbNextTurn } from "@/lib/orb.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "THE ORB — 20Q Mind Reader" },
      { name: "description", content: "Think of anything. The psychic Orb will read your mind in 20 questions or fewer." },
      { property: "og:title", content: "THE ORB — 20Q Mind Reader" },
      { property: "og:description", content: "A retro 1980s psychic machine that reads your mind in 20 questions." },
    ],
  }),
  component: Game,
});

type Turn = { kind: "question" | "guess"; text: string; answer: string };
type Move = { type: "question" | "guess"; text: string; commentary: string; confidence: number };
type Phase = "intro" | "thinking" | "asking" | "guessing" | "won" | "lost" | "error";

const ANSWERS = ["Yes", "No", "Sometimes", "Doubtful", "Irrelevant"] as const;
const IDLE_LINES = [
  "Your neurons are… loud.",
  "I sense a shape in the static.",
  "Do not resist. It only helps me.",
  "The pattern tightens.",
  "Interesting. Most interesting.",
];

/* ---------- Audio ---------- */
function useSynth() {
  const ctx = useRef<AudioContext | null>(null);
  const hum = useRef<{ g: GainNode; o: OscillatorNode[] } | null>(null);
  const [on, setOn] = useState(false);
  const ensure = () => (ctx.current ??= new AudioContext());
  const toggle = () => {
    const c = ensure();
    if (hum.current) {
      hum.current.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.5);
      const h = hum.current;
      setTimeout(() => h.o.forEach((o) => o.stop()), 600);
      hum.current = null;
      setOn(false);
      return;
    }
    const g = c.createGain();
    g.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.15;
    lg.gain.value = 180;
    lfo.connect(lg).connect(f.frequency);
    const os = [55, 82.5, 110.3].map((fr, i) => {
      const o = c.createOscillator();
      o.type = i === 1 ? "triangle" : "sawtooth";
      o.frequency.value = fr;
      o.connect(f);
      o.start();
      return o;
    });
    lfo.start();
    f.connect(g).connect(c.destination);
    g.gain.linearRampToValueAtTime(0.06, c.currentTime + 1.5);
    hum.current = { g, o: [...os, lfo] };
    setOn(true);
  };
  const blip = (freq = 660, dur = 0.08) => {
    if (!on || !ctx.current) return;
    const c = ctx.current;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  };
  return { on, toggle, blip };
}

/* ---------- Orb ---------- */
function Orb({ mode, confidence }: { mode: "idle" | "think" | "reveal"; confidence: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: 10 + ((i * 37) % 80),
        top: 55 + ((i * 53) % 35),
        delay: (i * 0.37) % 4,
        dur: 3 + ((i * 0.7) % 3),
        dx: `${((i * 29) % 60) - 30}px`,
      })),
    [],
  );
  const hot = mode === "reveal";
  return (
    <div className="relative mx-auto aspect-square w-64 sm:w-80">
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, var(${hot ? "--amber" : "--glow"}) ${30 + confidence / 2}%, transparent), transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-2 rounded-full border border-primary/30"
        style={{ animation: "spin-slow 24s linear infinite", borderStyle: "dashed" }}
      />
      <div
        className="absolute inset-6 rounded-full border border-accent/30"
        style={{ animation: "spin-slow 14s linear infinite reverse", borderStyle: "dotted" }}
      />
      <div
        className="absolute inset-10 overflow-hidden rounded-full"
        style={{
          animation: `${mode === "think" ? "orb-think 1.1s" : "orb-pulse 4s"} ease-in-out infinite`,
          background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--foreground) 90%, transparent), var(${hot ? "--amber" : "--glow"}) 25%, color-mix(in oklab, var(${hot ? "--amber" : "--glow"}) 35%, var(--background)) 60%, var(--background) 100%)`,
          boxShadow: `0 0 60px color-mix(in oklab, var(${hot ? "--amber" : "--glow"}) 60%, transparent), inset 0 0 40px var(--background)`,
        }}
      >
        <div className="crt-scanlines absolute inset-0 opacity-70" />
        <div
          className="absolute inset-[30%] rounded-full blur-md"
          style={{ background: "var(--foreground)", opacity: 0.35 + confidence / 250 }}
        />
      </div>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            ["--dx" as string]: p.dx,
            animation: `float-up ${mode === "think" ? p.dur / 2 : p.dur}s ${p.delay}s linear infinite`,
            boxShadow: "0 0 6px var(--glow)",
          }}
        />
      ))}
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const segs = 20;
  const lit = Math.round((value / 100) * segs);
  return (
    <div>
      <div className="mb-1 flex justify-between font-display text-lg uppercase tracking-widest text-muted-foreground">
        <span>Psychic lock</span>
        <span className={value >= 85 ? "text-amber text-glow-amber" : "text-primary text-glow"}>{value}%</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: segs }, (_, i) => (
          <div
            key={i}
            className={`h-4 flex-1 transition-all duration-500 ${
              i < lit ? (i >= 16 ? "bg-amber" : "bg-primary") : "bg-muted"
            }`}
            style={i < lit ? { boxShadow: `0 0 8px var(${i >= 16 ? "--amber" : "--glow"})` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function TypeText({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 1)), 22);
    return () => clearInterval(id);
  }, [text]);
  return (
    <span>
      {text.slice(0, n)}
      <span className="anim-blink">▌</span>
    </span>
  );
}

function RetroButton({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "amber" | "muted";
}) {
  const tones = {
    primary: "border-primary text-primary hover:bg-primary hover:text-primary-foreground",
    amber: "border-amber text-amber hover:bg-amber hover:text-accent-foreground",
    muted: "border-muted-foreground text-muted-foreground hover:bg-muted-foreground hover:text-background",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-sm border-2 bg-card px-4 py-3 font-display text-2xl uppercase tracking-widest shadow-[0_4px_0_0_var(--muted)] transition-all active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-30 ${tones[tone]}`}
    >
      [{children}]
    </button>
  );
}

/* ---------- Game ---------- */
function Game() {
  const next = useServerFn(orbNextTurn);
  const joker = useServerFn(orbJoker);
  const synth = useSynth();

  const [phase, setPhase] = useState<Phase>("intro");
  const [history, setHistory] = useState<Turn[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [move, setMove] = useState<Move | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [comment, setComment] = useState("Think of anything. A thing, a creature, a person, a place, an idea.");
  const [error, setError] = useState("");
  const [jokerUsed, setJokerUsed] = useState(false);
  const [jokerOpen, setJokerOpen] = useState(false);
  const [jokerQ, setJokerQ] = useState("");
  const [jokerA, setJokerA] = useState("");
  const [jokerBusy, setJokerBusy] = useState(false);
  const [reveal, setReveal] = useState("");

  const questionsAsked = history.filter((h) => h.kind === "question").length;

  async function think(h: Turn[], w: string[]) {
    setPhase("thinking");
    setComment(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)] ?? "");
    try {
      const asked = h.filter((t) => t.kind === "question").length;
      if (w.length >= 3 && asked >= 20) {
        setPhase("lost");
        return;
      }
      const m = await next({ data: { history: h, wrongGuesses: w, questionsAsked: asked } });
      setMove(m);
      setConfidence(m.confidence);
      setComment(m.commentary);
      synth.blip(m.type === "guess" ? 330 : 880, 0.15);
      setPhase(m.type === "guess" ? "guessing" : "asking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The signal was lost.");
      setPhase("error");
    }
  }

  function start() {
    setHistory([]);
    setWrong([]);
    setMove(null);
    setConfidence(0);
    setJokerUsed(false);
    setJokerA("");
    setJokerQ("");
    setReveal("");
    think([], []);
  }

  function answer(a: string) {
    if (!move) return;
    synth.blip(520);
    const h = [...history, { kind: move.type, text: move.text, answer: a }];
    setHistory(h);
    if (move.type === "guess") {
      if (a === "Yes") {
        setReveal(move.text);
        setConfidence(100);
        setPhase("won");
        synth.blip(220, 1.2);
        return;
      }
      const w = [...wrong, move.text];
      setWrong(w);
      setConfidence((c) => Math.max(10, c - 30));
      think(h, w);
      return;
    }
    think(h, wrong);
  }

  async function askJoker() {
    if (!jokerQ.trim()) return;
    setJokerBusy(true);
    try {
      const r = await joker({ data: { history, question: jokerQ.trim() } });
      setJokerA(r.text);
      setJokerUsed(true);
    } catch (e) {
      setJokerA(e instanceof Error ? e.message : "The Orb refuses.");
    } finally {
      setJokerBusy(false);
    }
  }

  const orbMode = phase === "thinking" ? "think" : phase === "won" || phase === "guessing" ? "reveal" : "idle";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="crt-scanlines fixed inset-0 z-50 opacity-40" />
      <div className="crt-vignette fixed inset-0 z-40" />

      <div className="anim-flicker relative mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between border-b border-border pb-3 font-display text-xl uppercase tracking-[0.3em]">
          <span className="text-glow">Orb-20 // Psi Lab</span>
          <button onClick={synth.toggle} className="text-muted-foreground hover:text-primary">
            Hum: {synth.on ? "ON" : "OFF"}
          </button>
        </header>

        <Orb mode={orbMode} confidence={confidence} />

        <section className="min-h-24 text-center">
          {phase === "won" ? (
            <div>
              <p className="font-display text-xl uppercase tracking-widest text-muted-foreground">
                Your mind has been read
              </p>
              <h1 className="anim-reveal mt-2 font-display text-6xl uppercase text-amber text-glow-amber sm:text-7xl">
                {reveal}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Deduced in {questionsAsked} question{questionsAsked === 1 ? "" : "s"}.{" "}
                {wrong.length > 0 && `${wrong.length} false vision${wrong.length > 1 ? "s" : ""}.`}
              </p>
            </div>
          ) : phase === "lost" ? (
            <div>
              <h1 className="font-display text-5xl uppercase text-destructive">You have defeated me</h1>
              <p className="mt-2 text-muted-foreground">Your mind is a fortress. This has not happened in a long time.</p>
            </div>
          ) : phase === "intro" ? (
            <div>
              <h1 className="font-display text-6xl uppercase text-glow">The Orb</h1>
              <p className="mt-2 text-muted-foreground">{comment}</p>
              <p className="mt-1 text-sm text-muted-foreground">I will know it in twenty questions or fewer.</p>
            </div>
          ) : (
            <div>
              <p className="font-display text-lg uppercase tracking-widest text-muted-foreground">
                {phase === "guessing" ? "Vision" : `Query ${Math.min(questionsAsked + 1, 20)} / 20`}
              </p>
              <h1 className="mt-1 font-display text-4xl text-glow sm:text-5xl">
                {phase === "thinking" ? (
                  <span className="text-muted-foreground">
                    Probing<span className="anim-blink">…</span>
                  </span>
                ) : phase === "error" ? (
                  <span className="text-destructive">{error}</span>
                ) : phase === "guessing" ? (
                  <span className="text-amber text-glow-amber">Are you thinking of… {move?.text}?</span>
                ) : (
                  move?.text
                )}
              </h1>
              <p className="mt-3 text-sm italic text-accent">
                <TypeText text={`> ${comment}`} />
              </p>
            </div>
          )}
        </section>

        {phase !== "intro" && <Gauge value={confidence} />}

        <section className="flex flex-wrap justify-center gap-3">
          {(phase === "intro" || phase === "won" || phase === "lost" || phase === "error") && (
            <RetroButton onClick={start}>{phase === "intro" ? "I have it in mind" : phase === "error" ? "Retry" : "Again"}</RetroButton>
          )}
          {phase === "asking" &&
            ANSWERS.map((a) => (
              <RetroButton key={a} onClick={() => answer(a)} tone={a === "Yes" || a === "No" ? "primary" : "muted"}>
                {a}
              </RetroButton>
            ))}
          {phase === "guessing" && (
            <>
              <RetroButton tone="amber" onClick={() => answer("Yes")}>Right</RetroButton>
              <RetroButton onClick={() => answer("No")}>Wrong</RetroButton>
            </>
          )}
        </section>

        {(phase === "asking" || phase === "thinking" || phase === "guessing") && (
          <section className="rounded-sm border border-accent/50 bg-card/60 p-4">
            {!jokerOpen && !jokerUsed && (
              <button
                onClick={() => setJokerOpen(true)}
                className="w-full font-display text-xl uppercase tracking-widest text-accent hover:text-glow-amber"
              >
                ◈ Joker: Ask the Orb (once) ◈
              </button>
            )}
            {jokerOpen && !jokerUsed && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoFocus
                  maxLength={300}
                  value={jokerQ}
                  onChange={(e) => setJokerQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askJoker()}
                  placeholder="Type your question to the Orb…"
                  className="flex-1 rounded-sm border border-accent/60 bg-background px-3 py-2 text-accent outline-none placeholder:text-muted-foreground focus:border-accent"
                />
                <RetroButton tone="amber" onClick={askJoker} disabled={jokerBusy}>
                  {jokerBusy ? "…" : "Ask"}
                </RetroButton>
              </div>
            )}
            {jokerUsed && (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">You asked: {jokerQ}</p>
                <p className="mt-2 text-accent text-glow-amber">
                  <TypeText text={jokerA} />
                </p>
              </div>
            )}
          </section>
        )}

        {history.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-display text-lg uppercase tracking-widest">
              Session log ({history.length})
            </summary>
            <ol className="mt-2 space-y-1">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-4 border-b border-border/40 py-1">
                  <span>{h.kind === "guess" ? `Guess: ${h.text}` : h.text}</span>
                  <span className="text-primary">{h.answer}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </main>
  );
}
