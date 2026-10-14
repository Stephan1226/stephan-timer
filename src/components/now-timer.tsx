import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "jigeum.timer.v1";
const BOT_KEY = "jigeum.bot.v1";
const DEFAULT_BOT = "누구 혹은 채팅";
const MIN_MS = 60_000;
const MAX_MS = 180 * 60_000;
const PRESETS = [5, 10, 15, 25, 45, 60];

type Phase = "idle" | "running" | "paused" | "done";

type Session = {
  id: string;
  activity: string;
  plannedMs: number;
  elapsedMs: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
};

type TimerState = {
  activity: string;
  plannedMs: number;
  phase: Phase;
  endsAt: number | null;
  remainingMs: number;
  startedAt: number | null;
  sessions: Session[];
};

const INITIAL: TimerState = {
  activity: "",
  plannedMs: 25 * 60_000,
  phase: "idle",
  endsAt: null,
  remainingMs: 25 * 60_000,
  startedAt: null,
  sessions: [],
};

function clampMs(ms: number) {
  return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function finishState(s: TimerState, completed: boolean): TimerState {
  if (s.phase !== "running" && s.phase !== "paused") return s;
  const now = Date.now();
  const remaining =
    s.phase === "running" && s.endsAt != null ? Math.max(0, s.endsAt - now) : s.remainingMs;
  const elapsedMs = completed
    ? s.plannedMs
    : Math.min(s.plannedMs, Math.max(0, s.plannedMs - remaining));
  const session: Session = {
    id: makeId(),
    activity: s.activity.trim(),
    plannedMs: s.plannedMs,
    elapsedMs,
    startedAt: s.startedAt ?? now,
    endedAt: now,
    completed,
  };
  return {
    ...s,
    phase: "done",
    endsAt: null,
    remainingMs: completed ? 0 : remaining,
    sessions: [session, ...s.sessions].slice(0, 30),
  };
}

function isSession(v: unknown): v is Session {
  if (!v || typeof v !== "object") return false;
  const o = v as Session;
  return (
    typeof o.id === "string" &&
    typeof o.activity === "string" &&
    typeof o.plannedMs === "number" &&
    typeof o.elapsedMs === "number" &&
    typeof o.startedAt === "number" &&
    typeof o.endedAt === "number" &&
    typeof o.completed === "boolean"
  );
}

function sanitize(raw: unknown): TimerState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as TimerState;
  const phases: Phase[] = ["idle", "running", "paused", "done"];
  if (!phases.includes(o.phase)) return null;
  if (typeof o.activity !== "string") return null;
  if (typeof o.plannedMs !== "number") return null;
  const plannedMs = clampMs(o.plannedMs);
  const sessions = Array.isArray(o.sessions) ? o.sessions.filter(isSession).slice(0, 30) : [];
  const remainingMs =
    typeof o.remainingMs === "number" ? Math.max(0, o.remainingMs) : plannedMs;
  return {
    activity: o.activity.slice(0, 80),
    plannedMs,
    phase: o.phase,
    endsAt: typeof o.endsAt === "number" ? o.endsAt : null,
    remainingMs,
    startedAt: typeof o.startedAt === "number" ? o.startedAt : null,
    sessions,
  };
}

function loadState(): TimerState {
  try {
    const parsed = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? ""));
    if (!parsed) return INITIAL;
    if (parsed.phase === "running" && parsed.endsAt != null) {
      if (parsed.endsAt <= Date.now()) return finishState(parsed, true);
      return { ...parsed, remainingMs: parsed.endsAt - Date.now() };
    }
    if (parsed.phase === "idle") return { ...parsed, remainingMs: parsed.plannedMs, endsAt: null };
    return parsed;
  } catch {
    return INITIAL;
  }
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function clock(ts: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(ts);
}

export function practiceLine(s: Session) {
  const name = s.activity.trim() || "이름 없는 일";
  const start = clock(s.startedAt);
  const end = clock(s.endedAt);
  const span = start === end ? start : `${start}–${end}`;
  if (s.elapsedMs < 45_000) {
    return `「${name}」 거의 시작하자마자 멈췄어. ${span}.`;
  }
  const mins = Math.max(1, Math.round(s.elapsedMs / 60_000));
  if (s.completed) return `방금 「${name}」 ${mins}분 끝냈어. ${span}.`;
  const goal = Math.max(1, Math.round(s.plannedMs / 60_000));
  return `「${name}」 ${mins}분 하고 멈췄어. 목표는 ${goal}분이었어. ${span}.`;
}

export function sessionMessage(s: Session, target: string) {
  const who = target.trim() || DEFAULT_BOT;
  return `이렇게 실천한 내용을 그록 봇 [${who}]에 알려줘.\n\n${practiceLine(s)}`;
}

function loadBot() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOT_KEY) ?? "null");
    if (typeof raw === "string") return raw.slice(0, 40);
  } catch {
    /* keep the default bracket */
  }
  return "";
}

function grokHref(message: string) {
  return `https://grok.com/?q=${encodeURIComponent(message)}`;
}

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

let audioCtx: AudioContext | null = null;

function unlockAudio() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function chime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.11;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(gain);
    gain.connect(audioCtx!.destination);
    osc.start(t);
    osc.stop(t + 0.46);
  });
}

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

function ringProgress(s: TimerState) {
  const planned = s.plannedMs || 1;
  if (s.phase === "idle") return 1;
  if (s.phase === "done") {
    const latest = s.sessions[0];
    if (!latest) return 0;
    return Math.min(1, latest.elapsedMs / (latest.plannedMs || 1));
  }
  return Math.min(1, Math.max(0, s.remainingMs / planned));
}

export function NowTimer() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<TimerState>(INITIAL);
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [botTarget, setBotTarget] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const phaseRef = useRef<Phase | null>(null);

  useEffect(() => {
    setState(loadState());
    setBotTarget(loadBot());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(BOT_KEY, JSON.stringify(botTarget));
  }, [ready, botTarget]);

  useEffect(() => {
    if (state.phase !== "running" || state.endsAt == null) return;
    const id = window.setInterval(() => {
      setState((s) => {
        if (s.phase !== "running" || s.endsAt == null) return s;
        const left = s.endsAt - Date.now();
        if (left <= 0) return finishState(s, true);
        return { ...s, remainingMs: left };
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [state.phase, state.endsAt]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      setState((s) => {
        if (s.phase !== "running" || s.endsAt == null) return s;
        const left = s.endsAt - Date.now();
        if (left <= 0) return finishState(s, true);
        return { ...s, remainingMs: left };
      });
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (phaseRef.current == null) {
      phaseRef.current = state.phase;
      return;
    }
    if (phaseRef.current !== "done" && state.phase === "done") {
      chime();
      navigator.vibrate?.([40, 30, 80]);
      const session = state.sessions[0];
      if (
        session &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("지금", { body: practiceLine(session) });
        } catch {
          /* notification may be blocked */
        }
      }
    }
    phaseRef.current = state.phase;
  }, [ready, state.phase, state.sessions]);

  useEffect(() => {
    if (state.phase === "running") document.title = `${formatMs(state.remainingMs)} · 지금`;
    else if (state.phase === "done") document.title = "끝났어 · 지금";
    else document.title = "지금";
  }, [state.phase, state.remainingMs]);

  useEffect(() => {
    if (state.phase !== "running") return;
    let lock: WakeLockSentinel | null = null;
    let dropped = false;
    void navigator.wakeLock
      ?.request("screen")
      .then((sent) => {
        if (dropped) void sent.release();
        else lock = sent;
      })
      .catch(() => {});
    return () => {
      dropped = true;
      void lock?.release();
    };
  }, [state.phase]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      e.preventDefault();
      if (state.phase === "idle" || state.phase === "paused") start();
      else if (state.phase === "running") pause();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const minutes = Math.round(state.plannedMs / 60_000);
  const latest = state.phase === "done" ? state.sessions[0] : undefined;
  const today = state.sessions.filter((s) => isToday(s.endedAt)).slice(0, 6);
  const shownMs =
    state.phase === "done"
      ? (latest?.elapsedMs ?? 0)
      : state.phase === "idle"
        ? state.plannedMs
        : state.remainingMs;
  const progress = ringProgress(state);
  const caption =
    state.phase === "running"
      ? "남은 시간"
      : state.phase === "paused"
        ? "잠시 멈춤"
        : state.phase === "done"
          ? latest?.completed
            ? "끝났어"
            : "멈췄어"
          : "맞춰 둔 시간";

  function setPlannedMinutes(next: number) {
    const plannedMs = clampMs(Math.round(next) * 60_000);
    setState((s) => (s.phase === "idle" ? { ...s, plannedMs, remainingMs: plannedMs } : s));
  }

  function start() {
    unlockAudio();
    setSettingsOpen(false);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setNote(null);
    setState((s) => {
      const now = Date.now();
      if (s.phase === "paused") {
        return { ...s, phase: "running", endsAt: now + s.remainingMs };
      }
      if (s.phase !== "idle") return s;
      return {
        ...s,
        phase: "running",
        startedAt: now,
        endsAt: now + s.plannedMs,
        remainingMs: s.plannedMs,
      };
    });
  }

  function pause() {
    setState((s) => {
      if (s.phase !== "running" || s.endsAt == null) return s;
      return {
        ...s,
        phase: "paused",
        remainingMs: Math.max(0, s.endsAt - Date.now()),
        endsAt: null,
      };
    });
  }

  function stopEarly() {
    setNote(null);
    setState((s) => finishState(s, false));
  }

  function again() {
    setNote(null);
    setState((s) => ({
      ...s,
      phase: "idle",
      endsAt: null,
      remainingMs: s.plannedMs,
      startedAt: null,
    }));
  }

  async function copyMessage(message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setNote("복사했어. 이 대화에 붙여 넣으면 돼.");
    } catch {
      setNote("복사는 막혀 있어. 문장을 길게 눌러 복사해.");
    }
  }

  const shownMinutes = draft ?? String(minutes);
  const botLabel = botTarget.trim() || DEFAULT_BOT;
  const latestMessage = latest ? sessionMessage(latest, botTarget) : "";

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-8 pb-12">
        <header>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm tracking-widest text-muted">지금</p>
            <button
              type="button"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex h-11 items-center text-sm text-accent"
            >
              {settingsOpen ? "닫기" : "그록봇 설정"}
            </button>
          </div>
          {settingsOpen && (
            <div className="mt-5">
              <label className="block">
                <span className="text-sm text-muted">괄호 안. 누구, 혹은 어느 채팅</span>
                <input
                  value={botTarget}
                  maxLength={40}
                  placeholder={DEFAULT_BOT}
                  autoComplete="off"
                  onChange={(e) => setBotTarget(e.target.value)}
                  className="mt-2 w-full border-b border-line bg-transparent pb-2 text-lg text-ink outline-none placeholder:text-muted focus:border-ink"
                />
              </label>
              <p className="mt-4 text-sm text-pretty text-muted">
                이렇게 실천한 내용을 그록 봇 [{botLabel}]에 알려줘.
              </p>
            </div>
          )}
        </header>

        <section className="mt-8 flex flex-col items-center">
          <p className="text-sm text-muted">{caption}</p>
          <div className="relative grid size-72 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="1.25" className="stroke-line" />
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                fill="none"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="stroke-accent"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - progress)}
              />
            </svg>
            <p
              role="timer"
              aria-label={caption}
              className="font-display text-7xl leading-none font-medium tabular-nums"
            >
              {formatMs(shownMs)}
            </p>
          </div>

          {state.phase === "idle" ? (
            <label className="mt-8 w-full">
              <span className="text-sm text-muted">하는 일</span>
              <input
                value={state.activity}
                maxLength={80}
                placeholder="논문 읽기"
                autoComplete="off"
                onChange={(e) => {
                  const activity = e.target.value;
                  setState((s) => (s.phase === "idle" ? { ...s, activity } : s));
                }}
                className="mt-2 w-full border-b border-line bg-transparent pb-2 text-xl text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </label>
          ) : (
            <p className="mt-8 w-full truncate text-center text-xl">
              {state.activity.trim() || "이름 없는 일"}
            </p>
          )}
        </section>

        {state.phase === "idle" && (
          <div className="mt-8 flex flex-col gap-5">
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((n) => {
                const on = n === minutes && draft == null;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setPlannedMinutes(n);
                    }}
                    className={
                      on
                        ? "h-11 min-w-14 rounded-full bg-ink px-3 text-sm text-paper"
                        : "h-11 min-w-14 rounded-full border border-line bg-paper px-3 text-sm text-ink"
                    }
                  >
                    {n}분
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="5분 줄이기"
                onClick={() => {
                  setDraft(null);
                  setPlannedMinutes(minutes - 5);
                }}
                className="grid size-12 place-items-center rounded-full border border-line text-lg"
              >
                −
              </button>
              <label className="flex items-baseline gap-1">
                <span className="sr-only">직접 입력, 분</span>
                <input
                  inputMode="numeric"
                  value={shownMinutes}
                  onFocus={() => setDraft(String(minutes))}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setDraft(digits);
                    const n = Number(digits);
                    if (n >= 1) setPlannedMinutes(Math.min(180, n));
                  }}
                  onBlur={() => {
                    const n = Number(draft);
                    setPlannedMinutes(Number.isFinite(n) && n >= 1 ? n : minutes);
                    setDraft(null);
                  }}
                  className="w-14 bg-transparent text-center text-lg tabular-nums outline-none"
                />
                <span className="text-sm text-muted">분</span>
              </label>
              <button
                type="button"
                aria-label="5분 늘리기"
                onClick={() => {
                  setDraft(null);
                  setPlannedMinutes(minutes + 5);
                }}
                className="grid size-12 place-items-center rounded-full border border-line text-lg"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={start}
              className="h-12 rounded-full bg-accent text-base font-medium text-accent-ink transition-opacity active:opacity-80 motion-reduce:transition-none"
            >
              시작
            </button>
            <p className="text-center text-sm text-pretty text-muted">
              끝나면 한 일을 그록에게 바로 보낼 수 있어요.
            </p>
          </div>
        )}

        {state.phase === "running" && (
          <div className="mt-10 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={pause}
              className="h-12 rounded-full border border-line text-base"
            >
              일시정지
            </button>
            <button
              type="button"
              onClick={stopEarly}
              className="h-12 rounded-full border border-line text-base"
            >
              멈추고 알리기
            </button>
          </div>
        )}

        {state.phase === "paused" && (
          <div className="mt-10 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={start}
              className="h-12 rounded-full bg-accent text-base font-medium text-accent-ink"
            >
              이어하기
            </button>
            <button
              type="button"
              onClick={stopEarly}
              className="h-12 rounded-full border border-line text-base"
            >
              멈추고 알리기
            </button>
          </div>
        )}

        {state.phase === "done" && latest && (
          <div className="mt-8 flex flex-col gap-3">
            <p className="text-sm text-muted">보낼 말</p>
            <p className="text-base whitespace-pre-wrap text-pretty">{latestMessage}</p>
            <a
              href={grokHref(latestMessage)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void navigator.clipboard?.writeText(latestMessage).then(
                  () => setNote("채팅이 열리고, 문장도 복사해 뒀어."),
                  () => setNote("그록 채팅을 열었어."),
                );
              }}
              className="flex h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-accent-ink"
            >
              그록에게 알리기
            </a>
            <button
              type="button"
              onClick={() => void copyMessage(latestMessage)}
              className="h-12 rounded-full border border-line text-base"
            >
              문장만 복사
            </button>
            <button type="button" onClick={again} className="h-12 text-base text-muted">
              한 번 더
            </button>
            {note && <p className="text-center text-sm text-muted">{note}</p>}
          </div>
        )}

        {state.phase === "idle" && today.length > 0 && (
          <section className="mt-12">
            <h2 className="text-sm text-muted">오늘</h2>
            <ul className="mt-2">
              {today.map((s) => {
                const message = sessionMessage(s, botTarget);
                const mins =
                  s.elapsedMs < 45_000 ? "1분 미만" : `${Math.max(1, Math.round(s.elapsedMs / 60_000))}분`;
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-t border-line py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{s.activity.trim() || "이름 없는 일"}</p>
                      <p className="text-sm text-muted">
                        {mins} · {clock(s.endedAt)}
                        {s.completed ? "" : " · 중단"}
                      </p>
                    </div>
                    <a
                      href={grokHref(message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        void navigator.clipboard?.writeText(message).catch(() => {});
                      }}
                      className="shrink-0 text-sm text-accent"
                    >
                      알리기
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
