import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { orbJoker, orbNextTurn, orbReactSecret } from "@/lib/orb.functions";
import { ANSWER_KEYS, LATIN_ANSWERS, T, parseOrder, type Lang } from "@/lib/mazaj-menu";
import { EXPIRED_MSG, remainingMs } from "@/lib/session";
import logo from "@/assets/mazaj-logo.png.asset.json";

const search = z.object({
  table: fallback(z.union([z.string(), z.number()]).transform(String), "").default(""),
  items: fallback(z.string(), "").default(""),
  lang: fallback(z.string(), "").default(""),
  ts: fallback(z.coerce.number(), 0).default(0),
  ttl: fallback(z.coerce.number(), 60).default(60),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(search),
  head: () => ({
    meta: [
      { title: "Mazaj — The Mind Reader of Mazaj Coffee Shop" },
      { name: "description", content: "Think of anything. Mazaj, the spirit of Mazaj Coffee & Brunch, reads your mind in 20 questions." },
      { property: "og:title", content: "Mazaj — The Mind Reader" },
      { property: "og:description", content: "Sip, think, and let Mazaj read your mind in 20 questions or fewer." },
    ],
  }),
  component: Game,
});

type Turn = { kind: "question" | "guess"; text: string; answer: string };
type Move = { type: "question" | "guess"; text: string; commentary: string; confidence: number };
type Phase = "intro" | "thinking" | "asking" | "guessing" | "won" | "lost" | "error";

/* ---------- Sound: a slow, mysterious café piano ---------- */
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// A minor nocturne: Am – Fmaj7 – Dm9 – E7sus, played as gentle arpeggios
const PROGRESSION = [
  { bass: 45, arp: [57, 60, 64, 69, 64, 60] },
  { bass: 41, arp: [57, 60, 64, 65, 64, 60] },
  { bass: 38, arp: [57, 62, 65, 69, 64, 62] },
  { bass: 40, arp: [56, 59, 62, 64, 62, 59] },
];
const MELODY = [76, null, 74, 72, null, 71, null, 72, 69, null, null, null];

function useSound() {
  const ctx = useRef<AudioContext | null>(null);
  const bus = useRef<GainNode | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [on, setOn] = useState(false);

  // Soft, warm piano voice: pure sine partials, gentle attack, long smooth release (no buzz, no clicks)
  function key(c: AudioContext, out: AudioNode, midi: number, t: number, vel = 0.25, len = 3.5) {
    const f = NOTE(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.03);
    g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(3200, f * 5), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.5), t + 1.5);
    lp.connect(g).connect(out);
    ([
      [1, 1],
      [2, 0.18],
      [3, 0.05],
    ] as const).forEach(([mult, amp]) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = "sine";
      o.frequency.value = f * mult;
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + len + 0.2);
    });
  }

  function makeBus(c: AudioContext) {
    const master = c.createGain();
    master.gain.value = 0.0001;
    // Smooth, decaying reverb tail: low-passed and smoothed noise so there is no hiss or crackle
    const len = Math.floor(c.sampleRate * 3);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let s = 0;
      for (let i = 0; i < len; i++) {
        s = s * 0.97 + (Math.random() * 2 - 1) * 0.03; // heavy smoothing removes grain
        d[i] = s * 6 * Math.pow(1 - i / len, 3);
      }
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2500;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    const input = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    input.connect(master);
    input.connect(verb).connect(tone).connect(wet).connect(master);
    master.connect(comp).connect(c.destination);
    return { master, input };
  }

  const toggle = () => {
    const c = (ctx.current ??= new AudioContext());
    void c.resume();
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
      const m = bus.current;
      if (m) {
        m.gain.setTargetAtTime(0.0001, c.currentTime, 0.5);
      }
      setOn(false);
      return;
    }
    const { master, input } = makeBus(c);
    bus.current = master;
    master.gain.setTargetAtTime(0.45, c.currentTime, 0.8);
    (master as GainNode & { _in?: GainNode })._in = input;
    const beat = 0.7;
    const barLen = beat * 6;
    let bar = 0;
    // Look-ahead scheduling on the audio clock for seamless, drift-free flow
    let nextBar = c.currentTime + 0.2;
    const schedule = () => {
      while (nextBar < c.currentTime + barLen * 1.5) {
        const t0 = nextBar;
        const ch = PROGRESSION[bar % PROGRESSION.length]!;
        key(c, input, ch.bass, t0, 0.16, barLen * 1.6);
        key(c, input, ch.bass + 12, t0 + 0.04, 0.07, barLen * 1.4);
        ch.arp.forEach((n, i) => key(c, input, n, t0 + i * beat + (i ? 0.015 : 0), 0.06 + (i % 2 ? 0 : 0.015), 4));
        if (bar % 2 === 1) {
          MELODY.slice((bar % 4) * 3, (bar % 4) * 3 + 6).forEach((n, i) => n && key(c, input, n, t0 + i * beat + beat / 2, 0.08, 4.5));
        }
        bar++;
        nextBar += barLen;
      }
    };
    schedule();
    timer.current = setInterval(schedule, 500);
    setOn(true);
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // a single soft piano note for transitions
  const chime = (freq = 880, dur = 2.5) => {
    if (!on || !ctx.current || !bus.current) return;
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    key(ctx.current, bus.current, midi, ctx.current.currentTime + 0.02, 0.12, dur + 1);
  };
  return { on, toggle, chime };
}

/* ---------- The core: a glass sphere of swirling coffee ---------- */
function Core({ mode, confidence }: { mode: "idle" | "think" | "reveal"; confidence: number }) {
  const speed = mode === "think" ? 4 : mode === "reveal" ? 14 : 22;
  return (
    <div className="relative mx-auto aspect-square w-56 sm:w-72">
      <div
        className="absolute -inset-8 rounded-full blur-3xl transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, var(--primary) ${20 + confidence / 3}%, transparent), transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 rounded-full border border-border" />
      <div className="absolute inset-3 rounded-full border border-border/60" style={{ animation: `swirl ${speed * 3}s linear infinite` }}>
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary" />
      </div>
      <div
        className="absolute inset-8 overflow-hidden rounded-full"
        style={{
          animation: `breathe ${mode === "think" ? 1.6 : 5}s ease-in-out infinite`,
          boxShadow: "inset 0 -20px 40px color-mix(in oklab, var(--background) 80%, transparent), 0 30px 60px -20px color-mix(in oklab, var(--primary) 40%, transparent)",
        }}
      >
        <div
          className="absolute -inset-1/4"
          style={{
            animation: `swirl ${speed}s linear infinite`,
            background:
              "conic-gradient(from 0deg, oklch(0.25 0.04 50), oklch(0.55 0.09 60), oklch(0.85 0.06 80), oklch(0.4 0.07 55), oklch(0.62 0.09 210 / 70%), oklch(0.3 0.05 50), oklch(0.25 0.04 50))",
            filter: "blur(18px)",
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle at 32% 25%, oklch(1 0 0 / 55%), transparent 22%), radial-gradient(circle at 50% 120%, oklch(0 0 0 / 50%), transparent 60%)" }}
        />
      </div>
    </div>
  );
}

function Certainty({ value, label }: { value: number; label: string }) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "ghost",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
        variant === "solid"
          ? "bg-primary text-primary-foreground hover:shadow-[0_10px_30px_-10px_var(--primary)]"
          : "glass text-foreground hover:border-primary/60 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

const BREAK = {
  ar: "مزاج راه يرتاح شوية ويشرب قهوتو… عاود بعد لحظة.",
  fr: "Mazaj prend une petite pause café… réessayez dans un instant.",
  en: "Mazaj is taking a short coffee break… try again in a moment.",
} as const;

const LOCK = {
  ar: { title: "الوقت كمل", body: "الـ60 دقيقة تاعكم خلصت. طلبو من السرفور يجددلكم الكود وزيدو العبو مع مزاج!", latin: "El wa9t kmel — tlbo mel serveur ydjeddedlkom el code." },
  fr: { title: "Le temps est écoulé", body: "Vos 60 minutes de jeu sont terminées. Demandez au serveur de renouveler votre accès pour continuer avec Mazaj !", latin: "" },
  en: { title: "Time's up", body: "Your 60 minutes of play are over. Ask your waiter to renew your access and keep playing with Mazaj!", latin: "" },
} as const;

function Locked({ lang, latin }: { lang: Lang; latin: boolean }) {
  const l = LOCK[lang];
  return (
    <section className="glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl p-8 text-center">
      <img src={logo.url} alt="Mazaj Coffee Shop" className="h-24 w-24 rounded-full object-cover ring-1 ring-border" />
      <h2 className="font-display text-3xl">{l.title}</h2>
      <p className="text-muted-foreground">{lang === "ar" && latin ? l.latin : l.body}</p>
      <p className="text-xs uppercase tracking-[0.25em] text-primary">Mazaj · مزاج</p>
    </section>
  );
}

const SECRET = {
  ar: { q: "قولي بالصح، واش كنت تخمم فيه؟", ph: "اكتب الكلمة تاعك…", btn: "كشف" },
  fr: { q: "Avouez… à quoi pensiez-vous ?", ph: "Votre mot secret…", btn: "Révéler" },
  en: { q: "Confess… what were you thinking of?", ph: "Your secret word…", btn: "Reveal" },
} as const;

/* ---------- Game ---------- */
function Game() {
  const q = Route.useSearch() as { table: string; items: string; lang: string; ts: number; ttl: number };
  const navigate = useNavigate({ from: "/" });
  const next = useServerFn(orbNextTurn);
  const joker = useServerFn(orbJoker);
  const react = useServerFn(orbReactSecret);
  const sound = useSound();

  const lang: Lang = q.lang === "ar" || q.lang === "fr" || q.lang === "en" ? q.lang : "fr";
  const [latin, setLatin] = useState(false);
  const t = T[lang];
  const table = String(q.table).slice(0, 20) || null;
  const order = useMemo(() => parseOrder(q.items), [q.items]);
  const orderNames = order.map((m) => m[lang]);
  // Preview/testing mode: in the editor preview, start a fresh 60-min pass automatically.
  const [testTs, setTestTs] = useState(0);
  useEffect(() => {
    const h = window.location.hostname;
    if (h.startsWith("id-preview--") || h.includes("lovableproject.com") || h === "localhost") {
      if (remainingMs(q.ts, q.ttl) === 0) setTestTs(Math.floor(Date.now() / 1000));
    }
  }, [q.ts, q.ttl]);
  const passTs = testTs || q.ts;
  const ctx = { lang, latin: lang === "ar" && latin, table, items: order.map((m) => m.fr), ts: passTs || undefined, ttl: q.ttl || undefined };
  const label = (a: (typeof ANSWER_KEYS)[number]) => (lang === "ar" && latin ? LATIN_ANSWERS[a] : t.answers[a]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [history, setHistory] = useState<Turn[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [move, setMove] = useState<Move | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [jokerUsed, setJokerUsed] = useState(false);
  const [jokerOpen, setJokerOpen] = useState(false);
  const [jokerQ, setJokerQ] = useState("");
  const [jokerA, setJokerA] = useState("");
  const [jokerBusy, setJokerBusy] = useState(false);
  const [reveal, setReveal] = useState("");
  const [secret, setSecret] = useState("");
  const [secretReply, setSecretReply] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(remainingMs(passTs, q.ttl));
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [passTs, q.ttl]);
  const expired = left === 0;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const questionsAsked = history.filter((h) => h.kind === "question").length;

  async function think(h: Turn[], w: string[]) {
    setPhase("thinking");
    try {
      const asked = h.filter((x) => x.kind === "question").length;
      if (w.length >= 3 && asked >= 20) return setPhase("lost");
      const m = await next({ data: { history: h, wrongGuesses: w, questionsAsked: asked, ...ctx } });
      setMove(m);
      setConfidence(m.confidence);
      setComment(m.commentary);
      sound.chime(m.type === "guess" ? 523 : 784);
      setPhase(m.type === "guess" ? "guessing" : "asking");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes(EXPIRED_MSG)) {
        setLeft(0);
        return;
      }
      setError(BREAK[lang]);
      setPhase("error");
    }
  }

  function start() {
    setHistory([]);
    setWrong([]);
    setMove(null);
    setConfidence(0);
    setJokerUsed(false);
    setJokerOpen(false);
    setJokerA("");
    setJokerQ("");
    setReveal("");
    setSecret("");
    setSecretReply("");
    setComment("");
    think([], []);
  }

  function answer(a: string) {
    if (!move) return;
    const h = [...history, { kind: move.type, text: move.text, answer: a }];
    setHistory(h);
    if (move.type === "guess") {
      if (a === "Yes") {
        setReveal(move.text);
        setConfidence(100);
        setPhase("won");
        sound.chime(392, 1.6);
        return;
      }
      const w = [...wrong, move.text];
      setWrong(w);
      setConfidence((c) => Math.max(10, c - 30));
      void think(h, w);
      return;
    }
    think(h, wrong);
  }

  async function revealSecret() {
    if (!secret.trim() || secretBusy) return;
    setSecretBusy(true);
    try {
      const r = await react({ data: { history, wrongGuesses: wrong, secret: secret.trim(), ...ctx } });
      setSecretReply(r.text);
      sound.chime(392, 1.4);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes(EXPIRED_MSG)) setLeft(0);
      else setSecretReply(BREAK[lang]);
    } finally {
      setSecretBusy(false);
    }
  }

  async function askJoker() {
    if (!jokerQ.trim()) return;
    setJokerBusy(true);
    try {
      const r = await joker({ data: { history, question: jokerQ.trim(), ...ctx } });
      setJokerA(r.text);
      setJokerUsed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes(EXPIRED_MSG)) setLeft(0);
      else setJokerA(BREAK[lang]);
    } finally {
      setJokerBusy(false);
    }
  }

  const coreMode = phase === "thinking" ? "think" : phase === "won" || phase === "guessing" ? "reveal" : "idle";
  const playing = phase === "asking" || phase === "thinking" || phase === "guessing";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="grain fixed inset-0" />

      <div className="relative mx-auto flex max-w-2xl flex-col gap-8 px-5 py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="Mazaj Coffee Shop" className="h-12 w-12 rounded-full object-cover ring-1 ring-border" />
            <div className="leading-tight">
              <p className="font-display text-xl">Mazaj</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Coffee · Brunch</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full glass p-1 text-xs">
            {(["ar", "fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => navigate({ search: (p) => ({ ...p, lang: l }) })}
                className={`rounded-full px-3 py-1.5 transition ${lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {l === "ar" ? "الدارجة" : l === "fr" ? "FR" : "EN"}
              </button>
            ))}
          </div>
        </header>

        {expired ? (
          <Locked lang={lang} latin={latin} />
        ) : (
        <>
        {left !== null && left > 0 && (
          <p className="-mb-4 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {lang === "ar" ? `باقي ${Math.ceil(left / 60000)} دقيقة` : lang === "fr" ? `${Math.ceil(left / 60000)} min restantes` : `${Math.ceil(left / 60000)} min left`}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            {table && (
              <span className="rounded-full glass px-3 py-1 text-foreground">
                {t.table} {table}
              </span>
            )}
            {orderNames.length > 0 && <span className="truncate">{orderNames.join(" · ")}</span>}
          </div>
          <div className="flex items-center gap-3">
            {lang === "ar" && (
              <button onClick={() => setLatin((v) => !v)} className="hover:text-foreground">
                {latin ? "عربي" : "Latin"}
              </button>
            )}
            <button onClick={sound.toggle} className="hover:text-foreground">
              {t.sound} {sound.on ? "●" : "○"}
            </button>
          </div>
        </div>


        <Core mode={coreMode} confidence={confidence} />

        <section className="min-h-32 text-center">
          {phase === "won" ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t.won}</p>
              <h1 className="anim-reveal mt-3 font-display text-5xl text-primary sm:text-6xl">{reveal}</h1>
              <p className="mt-4 text-sm text-muted-foreground">{t.inN(questionsAsked)}</p>
            </div>
          ) : phase === "lost" ? (
            <div className="anim-rise">
              <h1 className="font-display text-4xl sm:text-5xl">{t.lost}</h1>
              <p className="mt-3 text-muted-foreground">{t.lostSub}</p>
              {!secretReply ? (
                <div className="mx-auto mt-6 max-w-md">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{SECRET[lang].q}</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      maxLength={120}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && revealSecret()}
                      placeholder={SECRET[lang].ph}
                      className="flex-1 rounded-full border border-input bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                    />
                    <Btn variant="solid" onClick={revealSecret} disabled={secretBusy}>
                      {secretBusy ? "…" : SECRET[lang].btn}
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="anim-reveal mx-auto mt-6 max-w-md">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{secret}</p>
                  <p className="mt-3 font-display text-xl leading-snug text-accent">{secretReply}</p>
                </div>
              )}
            </div>
          ) : phase === "intro" ? (
            <div className="anim-rise">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t.title}</p>
              <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{t.tagline}</h1>
              <p className="mt-3 text-muted-foreground">{t.sub}</p>
            </div>
          ) : (
            <div key={move?.text + phase} className="anim-rise">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {phase === "guessing" ? t.vision : `${t.q} ${Math.min(questionsAsked + 1, 20)} / 20`}
              </p>
              <h1 className="mt-3 font-display text-3xl leading-snug sm:text-4xl">
                {phase === "thinking" ? (
                  <span className="text-muted-foreground">{t.thinking}…</span>
                ) : phase === "error" ? (
                  <span className="text-destructive">{error}</span>
                ) : phase === "guessing" ? (
                  <>
                    <span className="text-muted-foreground">{t.areYou} </span>
                    <span className="text-primary">{move?.text}</span>
                  </>
                ) : (
                  move?.text
                )}
              </h1>
              {comment && phase !== "error" && (
                <p className="mx-auto mt-4 max-w-md text-sm italic text-accent">{comment}</p>
              )}
            </div>
          )}
        </section>

        {phase !== "intro" && <Certainty value={confidence} label={t.lock} />}

        <section className="flex flex-wrap justify-center gap-2">
          {(phase === "intro" || phase === "won" || phase === "lost" || phase === "error") && (
            <Btn variant="solid" onClick={start}>
              {phase === "intro" ? t.start : phase === "error" ? t.retry : t.again}
            </Btn>
          )}
          {phase === "asking" &&
            ANSWER_KEYS.map((a) => (
              <Btn key={a} onClick={() => answer(a)} variant={a === "Yes" ? "solid" : "ghost"}>
                {label(a)}
              </Btn>
            ))}
          {phase === "guessing" && (
            <>
              <Btn variant="solid" onClick={() => answer("Yes")}>{t.right}</Btn>
              <Btn onClick={() => answer("No")}>{t.wrong}</Btn>
            </>
          )}
        </section>

        {playing && (
          <section className="glass rounded-2xl p-4">
            {!jokerOpen && !jokerUsed && (
              <button onClick={() => setJokerOpen(true)} className="w-full text-sm tracking-wide text-primary hover:opacity-80">
                ✦ {t.joker}
              </button>
            )}
            {jokerOpen && !jokerUsed && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  maxLength={300}
                  value={jokerQ}
                  onChange={(e) => setJokerQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askJoker()}
                  placeholder={t.jokerPh}
                  className="flex-1 rounded-full border border-input bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <Btn variant="solid" onClick={askJoker} disabled={jokerBusy}>
                  {jokerBusy ? "…" : t.ask}
                </Btn>
              </div>
            )}
            {jokerUsed && (
              <div className="anim-rise">
                <p className="text-xs text-muted-foreground">{t.youAsked}: {jokerQ}</p>
                <p className="mt-2 font-display text-xl leading-snug text-foreground">{jokerA}</p>
              </div>
            )}
          </section>
        )}

        {history.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.25em]">
              {t.log} ({history.length})
            </summary>
            <ol className="mt-3 space-y-1">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between gap-4 border-b border-border/50 py-2">
                  <span className="text-foreground/90">{h.text}</span>
                  <span className="shrink-0 text-primary">
                    {label(h.answer as (typeof ANSWER_KEYS)[number])}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        </>
        )}
      </div>
    </main>
  );
}
