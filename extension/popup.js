/* ============================================================
   Friction — Popup Logic
   Reads session state from background, updates UI, and provides
   quick start/end session controls.
   ============================================================ */

(function () {
  "use strict";

  // ── DOM Elements ──────────────────────────────────────────
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const timerDisplay = document.getElementById("timer-display");
  const timerValue = document.getElementById("timer-value");
  const btnStart = document.getElementById("btn-start");
  const btnEnd = document.getElementById("btn-end");
  const distractionsCount = document.getElementById("distractions-count");
  const overridesCount = document.getElementById("overrides-count");

  let updateInterval = null;

  // ── Format mm:ss ──────────────────────────────────────────
  function formatTime(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  // ── Update UI ─────────────────────────────────────────────
  function updateUI(session) {
    if (session && session.isActive && session.endTime > Date.now()) {
      // Active session
      statusBadge.className = "status-badge active";
      statusText.textContent = "Active";
      timerDisplay.classList.add("visible");
      btnStart.classList.add("hidden");
      btnEnd.classList.remove("hidden");

      const remaining = session.endTime - Date.now();
      timerValue.textContent = formatTime(remaining);
    } else {
      // Inactive
      statusBadge.className = "status-badge inactive";
      statusText.textContent = "Inactive";
      timerDisplay.classList.remove("visible");
      btnStart.classList.remove("hidden");
      btnEnd.classList.add("hidden");

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
  }

  // ── Load Stats ────────────────────────────────────────────
  function loadStats() {
    chrome.storage.local.get(["distractionLog", "overrideLog"], (data) => {
      const distractions = data.distractionLog || [];
      const overrides = data.overrideLog || [];

      // Count today's entries
      const today = new Date().toDateString();
      const todayDistractions = distractions.filter(
        (d) => new Date(d.timestamp).toDateString() === today
      );
      const todayOverrides = overrides.filter(
        (o) => new Date(o.timestamp).toDateString() === today
      );

      distractionsCount.textContent = todayDistractions.length;
      overridesCount.textContent = todayOverrides.length;
    });
  }

  // ── Refresh Loop ──────────────────────────────────────────
  function startRefresh() {
    const refresh = () => {
      chrome.runtime.sendMessage({ action: "getSession" }, (session) => {
        if (chrome.runtime.lastError) {
          console.error("[Friction Popup]", chrome.runtime.lastError.message);
          return;
        }
        updateUI(session);
      });
    };

    refresh();
    updateInterval = setInterval(refresh, 1000);
  }

  // ── Actions ───────────────────────────────────────────────

  window.handleStart = function () {
    btnStart.disabled = true;
    btnStart.textContent = "Starting...";

    chrome.runtime.sendMessage(
      { action: "startSession", duration: 10 },
      (session) => {
        if (chrome.runtime.lastError) {
          console.error("[Friction Popup]", chrome.runtime.lastError.message);
          btnStart.disabled = false;
          btnStart.textContent = "▶ Start 10-min session";
          return;
        }
        updateUI(session);
        btnStart.disabled = false;
        btnStart.textContent = "▶ Start 10-min session";
      }
    );
  };

  window.handleEnd = function () {
    btnEnd.disabled = true;
    btnEnd.textContent = "Ending...";

    chrome.runtime.sendMessage({ action: "endSession" }, (session) => {
      if (chrome.runtime.lastError) {
        console.error("[Friction Popup]", chrome.runtime.lastError.message);
        btnEnd.disabled = false;
        btnEnd.textContent = "■ End session";
        return;
      }
      updateUI(session);
      btnEnd.disabled = false;
      btnEnd.textContent = "■ End session";
    });
  };

  // ── Initialize ────────────────────────────────────────────
  startRefresh();
  loadStats();
})();
