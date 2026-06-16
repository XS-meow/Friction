"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createSession, getActiveSession, completeSession } from "@/lib/supabase";
import {
  startExtensionSession,
  endExtensionSession,
  getExtensionSession,
  pingExtension,
} from "@/lib/extension";

const SESSION_DURATION = 10; // minutes

export default function Home() {
  const [isActive, setIsActive] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Format mm:ss ────────────────────────────────────────
  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // ── Sync with extension ─────────────────────────────────
  // Poll the extension every 2 seconds to stay in sync.
  // If a session was started/ended from the popup, the
  // dashboard will pick it up.
  const syncWithExtension = useCallback(async () => {
    const extSession = await getExtensionSession();
    if (!extSession) return;

    if (extSession.isActive && extSession.endTime && extSession.endTime > Date.now()) {
      // Extension has an active session — sync our state
      if (!isActive || endTime !== extSession.endTime) {
        setIsActive(true);
        setEndTime(extSession.endTime);
      }
    } else if (isActive && !extSession.isActive) {
      // Extension ended the session (from popup or alarm) — sync
      setIsActive(false);
      setEndTime(null);
      setTimeRemaining(0);
      setSessionId(null);
    }
  }, [isActive, endTime]);

  // ── Check extension connectivity + initial sync ─────────
  useEffect(() => {
    pingExtension().then((connected) => {
      setExtensionConnected(connected);
      if (connected) {
        syncWithExtension();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Periodic sync with extension ────────────────────────
  useEffect(() => {
    syncRef.current = setInterval(() => {
      syncWithExtension();
    }, 2000);

    return () => {
      if (syncRef.current) clearInterval(syncRef.current);
    };
  }, [syncWithExtension]);

  // ── Check for existing active session in Supabase on load ─
  useEffect(() => {
    getActiveSession().then((session) => {
      if (session) {
        const sessionEndTime =
          new Date(session.start_time).getTime() +
          session.duration_minutes * 60 * 1000;
        const remaining = sessionEndTime - Date.now();

        if (remaining > 0) {
          setIsActive(true);
          setSessionId(session.id || null);
          setEndTime(sessionEndTime);
        }
      }
    });
  }, []);

  // ── Countdown timer (computed from endTime) ─────────────
  useEffect(() => {
    if (isActive && endTime) {
      // Compute remaining time from endTime — single source of truth
      const tick = () => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          setTimeRemaining(0);
          handleEnd();
        } else {
          setTimeRemaining(remaining);
        }
      };

      tick(); // immediate first tick
      timerRef.current = setInterval(tick, 1000);
    } else {
      setTimeRemaining(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, endTime]);

  // ── Start Session ───────────────────────────────────────
  const handleStart = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Log to Supabase
      const session = await createSession(SESSION_DURATION);
      if (session?.id) setSessionId(session.id);

      // 2. Start in extension and use its endTime as source of truth
      const extSession = await startExtensionSession(SESSION_DURATION);

      // 3. Use extension's endTime for perfect sync, fallback to computed
      const sessionEndTime = extSession?.endTime ?? (Date.now() + SESSION_DURATION * 60 * 1000);

      // 4. Update local state
      setIsActive(true);
      setEndTime(sessionEndTime);
    } catch (err) {
      console.error("[Friction] Failed to start session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── End Session ─────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Update Supabase
      if (sessionId) {
        await completeSession(sessionId);
      }

      // 2. Notify extension
      await endExtensionSession();

      // 3. Update local state
      setIsActive(false);
      setEndTime(null);
      setTimeRemaining(0);
      setSessionId(null);

      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      console.error("[Friction] Failed to end session:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // ── Progress percentage for visual indicator ────────────
  const totalMs = SESSION_DURATION * 60 * 1000;
  const progress = isActive ? ((totalMs - timeRemaining) / totalMs) * 100 : 0;

  return (
    <>
      <div className="bg-gradient" />

      <main className="page">
        {/* Header */}
        <div className="header fade-in-up">
          <div className="header-icon">🎯</div>
          <h1>Friction</h1>
          <p>Declare your focus. Block distractions. Build the habit.</p>
        </div>

        {/* Main Card */}
        <div className="card fade-in-up-delay-1">
          {/* Status bar */}
          <div className="session-status">
            <span className="status-label">Session</span>
            <span className={`status-badge ${isActive ? "active" : "inactive"}`}>
              <span className="status-dot" />
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Timer */}
          {isActive && (
            <div className="timer-container">
              <div className="timer-value">{formatTime(timeRemaining)}</div>
              <div className="timer-label">remaining</div>

              {/* Progress bar */}
              <div
                style={{
                  marginTop: "1.25rem",
                  height: "3px",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background:
                      "linear-gradient(90deg, #7c3aed, #ec4899)",
                    borderRadius: "2px",
                    transition: "width 1s linear",
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isActive ? (
            <button
              id="btn-start-session"
              className="btn btn-start"
              onClick={handleStart}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Starting...
                </>
              ) : (
                <>▶ Start {SESSION_DURATION}-Minute Session</>
              )}
            </button>
          ) : (
            <button
              id="btn-end-session"
              className="btn btn-end"
              onClick={handleEnd}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Ending...
                </>
              ) : (
                "■ End Session"
              )}
            </button>
          )}

          {/* Extension connection status */}
          <div className="connection-bar">
            <span
              className={`connection-dot ${
                extensionConnected ? "connected" : "disconnected"
              }`}
            />
            {extensionConnected
              ? "Extension connected"
              : "Extension not detected"}
          </div>
        </div>

        {/* Footer */}
        <footer className="footer fade-in-up-delay-2">
          <p>
            Built for focus. Not for metrics.
          </p>
        </footer>
      </main>
    </>
  );
}
