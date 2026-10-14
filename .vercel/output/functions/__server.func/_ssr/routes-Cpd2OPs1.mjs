import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Cpd2OPs1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STORAGE_KEY = "jigeum.timer.v1";
var BOT_KEY = "jigeum.bot.v1";
var DEFAULT_BOT = "누구 혹은 채팅";
var MIN_MS = 6e4;
var MAX_MS = 108e5;
var PRESETS = [
	5,
	10,
	15,
	25,
	45,
	60
];
var INITIAL = {
	activity: "",
	plannedMs: 15e5,
	phase: "idle",
	endsAt: null,
	remainingMs: 15e5,
	startedAt: null,
	sessions: []
};
function clampMs(ms) {
	return Math.min(MAX_MS, Math.max(MIN_MS, ms));
}
function makeId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function finishState(s, completed) {
	if (s.phase !== "running" && s.phase !== "paused") return s;
	const now = Date.now();
	const remaining = s.phase === "running" && s.endsAt != null ? Math.max(0, s.endsAt - now) : s.remainingMs;
	const elapsedMs = completed ? s.plannedMs : Math.min(s.plannedMs, Math.max(0, s.plannedMs - remaining));
	const session = {
		id: makeId(),
		activity: s.activity.trim(),
		plannedMs: s.plannedMs,
		elapsedMs,
		startedAt: s.startedAt ?? now,
		endedAt: now,
		completed
	};
	return {
		...s,
		phase: "done",
		endsAt: null,
		remainingMs: completed ? 0 : remaining,
		sessions: [session, ...s.sessions].slice(0, 30)
	};
}
function isSession(v) {
	if (!v || typeof v !== "object") return false;
	const o = v;
	return typeof o.id === "string" && typeof o.activity === "string" && typeof o.plannedMs === "number" && typeof o.elapsedMs === "number" && typeof o.startedAt === "number" && typeof o.endedAt === "number" && typeof o.completed === "boolean";
}
function sanitize(raw) {
	if (!raw || typeof raw !== "object") return null;
	const o = raw;
	if (![
		"idle",
		"running",
		"paused",
		"done"
	].includes(o.phase)) return null;
	if (typeof o.activity !== "string") return null;
	if (typeof o.plannedMs !== "number") return null;
	const plannedMs = clampMs(o.plannedMs);
	const sessions = Array.isArray(o.sessions) ? o.sessions.filter(isSession).slice(0, 30) : [];
	const remainingMs = typeof o.remainingMs === "number" ? Math.max(0, o.remainingMs) : plannedMs;
	return {
		activity: o.activity.slice(0, 80),
		plannedMs,
		phase: o.phase,
		endsAt: typeof o.endsAt === "number" ? o.endsAt : null,
		remainingMs,
		startedAt: typeof o.startedAt === "number" ? o.startedAt : null,
		sessions
	};
}
function loadState() {
	try {
		const parsed = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? ""));
		if (!parsed) return INITIAL;
		if (parsed.phase === "running" && parsed.endsAt != null) {
			if (parsed.endsAt <= Date.now()) return finishState(parsed, true);
			return {
				...parsed,
				remainingMs: parsed.endsAt - Date.now()
			};
		}
		if (parsed.phase === "idle") return {
			...parsed,
			remainingMs: parsed.plannedMs,
			endsAt: null
		};
		return parsed;
	} catch {
		return INITIAL;
	}
}
function formatMs(ms) {
	const total = Math.max(0, Math.ceil(ms / 1e3 - 1e-9));
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function clock(ts) {
	return new Intl.DateTimeFormat("ko-KR", {
		hour: "numeric",
		minute: "2-digit"
	}).format(ts);
}
function practiceLine(s) {
	const name = s.activity.trim() || "이름 없는 일";
	const start = clock(s.startedAt);
	const end = clock(s.endedAt);
	const span = start === end ? start : `${start}–${end}`;
	if (s.elapsedMs < 45e3) return `「${name}」 거의 시작하자마자 멈췄어. ${span}.`;
	const mins = Math.max(1, Math.round(s.elapsedMs / 6e4));
	if (s.completed) return `방금 「${name}」 ${mins}분 끝냈어. ${span}.`;
	return `「${name}」 ${mins}분 하고 멈췄어. 목표는 ${Math.max(1, Math.round(s.plannedMs / 6e4))}분이었어. ${span}.`;
}
function sessionMessage(s, target) {
	return `이렇게 실천한 내용을 그록 봇 [${target.trim() || DEFAULT_BOT}]에 알려줘.\n\n${practiceLine(s)}`;
}
function loadBot() {
	try {
		const raw = JSON.parse(localStorage.getItem(BOT_KEY) ?? "null");
		if (typeof raw === "string") return raw.slice(0, 40);
	} catch {}
	return "";
}
function grokHref(message) {
	return `https://grok.com/?q=${encodeURIComponent(message)}`;
}
function isToday(ts) {
	const d = new Date(ts);
	const n = /* @__PURE__ */ new Date();
	return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
var audioCtx = null;
function unlockAudio() {
	const AC = window.AudioContext || window.webkitAudioContext;
	if (!AC) return;
	if (!audioCtx) audioCtx = new AC();
	if (audioCtx.state === "suspended") audioCtx.resume();
}
function chime() {
	if (!audioCtx) return;
	const now = audioCtx.currentTime;
	[
		523.25,
		659.25,
		783.99
	].forEach((freq, i) => {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.type = "sine";
		osc.frequency.value = freq;
		const t = now + i * .11;
		gain.gain.setValueAtTime(1e-4, t);
		gain.gain.exponentialRampToValueAtTime(.07, t + .02);
		gain.gain.exponentialRampToValueAtTime(1e-4, t + .42);
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.start(t);
		osc.stop(t + .46);
	});
}
var RING_R = 44;
var RING_C = 2 * Math.PI * RING_R;
function ringProgress(s) {
	const planned = s.plannedMs || 1;
	if (s.phase === "idle") return 1;
	if (s.phase === "done") {
		const latest = s.sessions[0];
		if (!latest) return 0;
		return Math.min(1, latest.elapsedMs / (latest.plannedMs || 1));
	}
	return Math.min(1, Math.max(0, s.remainingMs / planned));
}
function NowTimer() {
	const [ready, setReady] = (0, import_react.useState)(false);
	const [state, setState] = (0, import_react.useState)(INITIAL);
	const [draft, setDraft] = (0, import_react.useState)(null);
	const [note, setNote] = (0, import_react.useState)(null);
	const [botTarget, setBotTarget] = (0, import_react.useState)("");
	const [settingsOpen, setSettingsOpen] = (0, import_react.useState)(false);
	const phaseRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		setState(loadState());
		setBotTarget(loadBot());
		setReady(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	}, [ready, state]);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		localStorage.setItem(BOT_KEY, JSON.stringify(botTarget));
	}, [ready, botTarget]);
	(0, import_react.useEffect)(() => {
		if (state.phase !== "running" || state.endsAt == null) return;
		const id = window.setInterval(() => {
			setState((s) => {
				if (s.phase !== "running" || s.endsAt == null) return s;
				const left = s.endsAt - Date.now();
				if (left <= 0) return finishState(s, true);
				return {
					...s,
					remainingMs: left
				};
			});
		}, 200);
		return () => window.clearInterval(id);
	}, [state.phase, state.endsAt]);
	(0, import_react.useEffect)(() => {
		function onVis() {
			if (document.visibilityState !== "visible") return;
			setState((s) => {
				if (s.phase !== "running" || s.endsAt == null) return s;
				const left = s.endsAt - Date.now();
				if (left <= 0) return finishState(s, true);
				return {
					...s,
					remainingMs: left
				};
			});
		}
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		if (phaseRef.current == null) {
			phaseRef.current = state.phase;
			return;
		}
		if (phaseRef.current !== "done" && state.phase === "done") {
			chime();
			navigator.vibrate?.([
				40,
				30,
				80
			]);
			const session = state.sessions[0];
			if (session && typeof Notification !== "undefined" && Notification.permission === "granted") try {
				new Notification("지금", { body: practiceLine(session) });
			} catch {}
		}
		phaseRef.current = state.phase;
	}, [
		ready,
		state.phase,
		state.sessions
	]);
	(0, import_react.useEffect)(() => {
		if (state.phase === "running") document.title = `${formatMs(state.remainingMs)} · 지금`;
		else if (state.phase === "done") document.title = "끝났어 · 지금";
		else document.title = "지금";
	}, [state.phase, state.remainingMs]);
	(0, import_react.useEffect)(() => {
		if (state.phase !== "running") return;
		let lock = null;
		let dropped = false;
		navigator.wakeLock?.request("screen").then((sent) => {
			if (dropped) sent.release();
			else lock = sent;
		}).catch(() => {});
		return () => {
			dropped = true;
			lock?.release();
		};
	}, [state.phase]);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			if (e.code !== "Space") return;
			const tag = e.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
			e.preventDefault();
			if (state.phase === "idle" || state.phase === "paused") start();
			else if (state.phase === "running") pause();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	const minutes = Math.round(state.plannedMs / 6e4);
	const latest = state.phase === "done" ? state.sessions[0] : void 0;
	const today = state.sessions.filter((s) => isToday(s.endedAt)).slice(0, 6);
	const shownMs = state.phase === "done" ? latest?.elapsedMs ?? 0 : state.phase === "idle" ? state.plannedMs : state.remainingMs;
	const progress = ringProgress(state);
	const caption = state.phase === "running" ? "남은 시간" : state.phase === "paused" ? "잠시 멈춤" : state.phase === "done" ? latest?.completed ? "끝났어" : "멈췄어" : "맞춰 둔 시간";
	function setPlannedMinutes(next) {
		const plannedMs = clampMs(Math.round(next) * 6e4);
		setState((s) => s.phase === "idle" ? {
			...s,
			plannedMs,
			remainingMs: plannedMs
		} : s);
	}
	function start() {
		unlockAudio();
		setSettingsOpen(false);
		if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
		setNote(null);
		setState((s) => {
			const now = Date.now();
			if (s.phase === "paused") return {
				...s,
				phase: "running",
				endsAt: now + s.remainingMs
			};
			if (s.phase !== "idle") return s;
			return {
				...s,
				phase: "running",
				startedAt: now,
				endsAt: now + s.plannedMs,
				remainingMs: s.plannedMs
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
				endsAt: null
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
			startedAt: null
		}));
	}
	async function copyMessage(message) {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "min-h-dvh bg-paper text-ink",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-8 pb-12",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm tracking-widest text-muted",
						children: "지금"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-expanded": settingsOpen,
						onClick: () => setSettingsOpen((open) => !open),
						className: "flex h-11 items-center text-sm text-accent",
						children: settingsOpen ? "닫기" : "그록봇 설정"
					})]
				}), settingsOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-muted",
							children: "괄호 안. 누구, 혹은 어느 채팅"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: botTarget,
							maxLength: 40,
							placeholder: DEFAULT_BOT,
							autoComplete: "off",
							onChange: (e) => setBotTarget(e.target.value),
							className: "mt-2 w-full border-b border-line bg-transparent pb-2 text-lg text-ink outline-none placeholder:text-muted focus:border-ink"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-sm text-pretty text-muted",
						children: [
							"이렇게 실천한 내용을 그록 봇 [",
							botLabel,
							"]에 알려줘."
						]
					})]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-8 flex flex-col items-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: caption
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative grid size-72 place-items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
								viewBox: "0 0 100 100",
								className: "absolute inset-0 size-full -rotate-90",
								"aria-hidden": "true",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "50",
									cy: "50",
									r: RING_R,
									fill: "none",
									strokeWidth: "1.25",
									className: "stroke-line"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
									cx: "50",
									cy: "50",
									r: RING_R,
									fill: "none",
									strokeWidth: "1.75",
									strokeLinecap: "round",
									className: "stroke-accent",
									strokeDasharray: RING_C,
									strokeDashoffset: RING_C * (1 - progress)
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								role: "timer",
								"aria-label": caption,
								className: "font-display text-7xl leading-none font-medium tabular-nums",
								children: formatMs(shownMs)
							})]
						}),
						state.phase === "idle" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "mt-8 w-full",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm text-muted",
								children: "하는 일"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: state.activity,
								maxLength: 80,
								placeholder: "논문 읽기",
								autoComplete: "off",
								onChange: (e) => {
									const activity = e.target.value;
									setState((s) => s.phase === "idle" ? {
										...s,
										activity
									} : s);
								},
								className: "mt-2 w-full border-b border-line bg-transparent pb-2 text-xl text-ink outline-none placeholder:text-muted focus:border-ink"
							})]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-8 w-full truncate text-center text-xl",
							children: state.activity.trim() || "이름 없는 일"
						})
					]
				}),
				state.phase === "idle" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-col gap-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap justify-center gap-2",
							children: PRESETS.map((n) => {
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => {
										setDraft(null);
										setPlannedMinutes(n);
									},
									className: n === minutes && draft == null ? "h-11 min-w-14 rounded-full bg-ink px-3 text-sm text-paper" : "h-11 min-w-14 rounded-full border border-line bg-paper px-3 text-sm text-ink",
									children: [n, "분"]
								}, n);
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-center gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "5분 줄이기",
									onClick: () => {
										setDraft(null);
										setPlannedMinutes(minutes - 5);
									},
									className: "grid size-12 place-items-center rounded-full border border-line text-lg",
									children: "−"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "flex items-baseline gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "sr-only",
											children: "직접 입력, 분"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											inputMode: "numeric",
											value: shownMinutes,
											onFocus: () => setDraft(String(minutes)),
											onChange: (e) => {
												const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
												setDraft(digits);
												const n = Number(digits);
												if (n >= 1) setPlannedMinutes(Math.min(180, n));
											},
											onBlur: () => {
												const n = Number(draft);
												setPlannedMinutes(Number.isFinite(n) && n >= 1 ? n : minutes);
												setDraft(null);
											},
											className: "w-14 bg-transparent text-center text-lg tabular-nums outline-none"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-muted",
											children: "분"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "5분 늘리기",
									onClick: () => {
										setDraft(null);
										setPlannedMinutes(minutes + 5);
									},
									className: "grid size-12 place-items-center rounded-full border border-line text-lg",
									children: "+"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: start,
							className: "h-12 rounded-full bg-accent text-base font-medium text-accent-ink transition-opacity active:opacity-80 motion-reduce:transition-none",
							children: "시작"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-sm text-pretty text-muted",
							children: "끝나면 한 일을 그록에게 바로 보낼 수 있어요."
						})
					]
				}),
				state.phase === "running" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-10 grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: pause,
						className: "h-12 rounded-full border border-line text-base",
						children: "일시정지"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: stopEarly,
						className: "h-12 rounded-full border border-line text-base",
						children: "멈추고 알리기"
					})]
				}),
				state.phase === "paused" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-10 grid grid-cols-2 gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: start,
						className: "h-12 rounded-full bg-accent text-base font-medium text-accent-ink",
						children: "이어하기"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: stopEarly,
						className: "h-12 rounded-full border border-line text-base",
						children: "멈추고 알리기"
					})]
				}),
				state.phase === "done" && latest && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "보낼 말"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-base whitespace-pre-wrap text-pretty",
							children: latestMessage
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: grokHref(latestMessage),
							target: "_blank",
							rel: "noopener noreferrer",
							onClick: () => {
								navigator.clipboard?.writeText(latestMessage).then(() => setNote("채팅이 열리고, 문장도 복사해 뒀어."), () => setNote("그록 채팅을 열었어."));
							},
							className: "flex h-12 items-center justify-center rounded-full bg-accent text-base font-medium text-accent-ink",
							children: "그록에게 알리기"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void copyMessage(latestMessage),
							className: "h-12 rounded-full border border-line text-base",
							children: "문장만 복사"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: again,
							className: "h-12 text-base text-muted",
							children: "한 번 더"
						}),
						note && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-center text-sm text-muted",
							children: note
						})
					]
				}),
				state.phase === "idle" && today.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-12",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm text-muted",
						children: "오늘"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2",
						children: today.map((s) => {
							const message = sessionMessage(s, botTarget);
							const mins = s.elapsedMs < 45e3 ? "1분 미만" : `${Math.max(1, Math.round(s.elapsedMs / 6e4))}분`;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center justify-between gap-3 border-t border-line py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "truncate",
										children: s.activity.trim() || "이름 없는 일"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "text-sm text-muted",
										children: [
											mins,
											" · ",
											clock(s.endedAt),
											s.completed ? "" : " · 중단"
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: grokHref(message),
									target: "_blank",
									rel: "noopener noreferrer",
									onClick: () => {
										navigator.clipboard?.writeText(message).catch(() => {});
									},
									className: "shrink-0 text-sm text-accent",
									children: "알리기"
								})]
							}, s.id);
						})
					})]
				})
			]
		})
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NowTimer, {});
}
//#endregion
export { Home as component };
