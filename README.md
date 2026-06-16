# 🎯 Friction

**A personal focus OS that reflects your behavior back at you — not just another blunt blocker.**

Cold Turkey and Freedom are blunt instruments — they just block. Friction is different. It adds *friction* to distraction, logs your patterns, and lets you see *when* and *why* you break focus. You built it for yourself, so it's tuned to how you think.

---

## What it does

A dashboard + Chrome extension system for intentional focus sessions:

- **🧠 Session Planner** — Declare *"I'm working on X for 90 mins"* before starting. No passive tracking — you commit upfront.
- **📵 Smart Blocking** — Distracting sites are blocked *only during active sessions*. Not always-on, so it doesn't feel oppressive.
- **🔇 Soft Block, Not Hard Block** — Visiting Instagram during a session doesn't just fail. It shows a fullscreen *"you're in a focus session"* page with a 10-second countdown. Annoyance is enough of a deterrent — and you still feel in control.
- **📊 Distraction Logging** — Every blocked visit is silently logged with a timestamp. You see *what* pulled you away and *when*.
- **🔥 Override Tracking** — If you push through the countdown, that's logged too. No judgment, just data.

---

## Tech Stack

```
Next.js + TypeScript     →  Dashboard UI
Supabase                 →  Session persistence
Chrome Extension (MV3)   →  Site blocking + session timer
Vanilla JS               →  Extension (no build step)
chrome.alarms             →  Survives service worker dormancy
declarativeNetRequest    →  Fast, declarative URL blocking
```

<p align="center">
  <em>Built for focus. Not for metrics.</em>
</p>
