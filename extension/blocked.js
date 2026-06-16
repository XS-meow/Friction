/* ============================================================
   Friction — Blocked Page Logic
   Handles the 10-second countdown, domain display, and user
   actions (go back / proceed anyway).
   ============================================================ */

(function () {
  "use strict";

  const COUNTDOWN_SECONDS = 10;
  const CIRCUMFERENCE = 2 * Math.PI * 65; // r=65 from the SVG

  // ── DOM Elements ──────────────────────────────────────────
  const domainEl = document.getElementById("blocked-domain");
  const countdownEl = document.getElementById("countdown-number");
  const progressRing = document.getElementById("progress-ring");
  const countdownLabel = document.getElementById("countdown-label");
  const btnProceed = document.getElementById("btn-proceed");

  // ── Parse the blocked URL from query params ───────────────
  const params = new URLSearchParams(window.location.search);
  const blockedUrl = params.get("url") || "";

  let blockedDomain = "";
  try {
    blockedDomain = new URL(blockedUrl).hostname;
  } catch {
    // If URL parsing fails, try to extract domain from the raw string
    const match = blockedUrl.match(/(?:https?:\/\/)?([^/]+)/);
    blockedDomain = match ? match[1] : "unknown site";
  }

  domainEl.textContent = blockedDomain;

  // ── Log this distraction attempt ──────────────────────────
  if (chrome?.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      action: "logDistraction",
      url: blockedUrl,
    });
  }

  // ── Countdown Timer ───────────────────────────────────────
  let remaining = COUNTDOWN_SECONDS;

  // Initialize the progress ring
  progressRing.style.strokeDasharray = CIRCUMFERENCE;
  progressRing.style.strokeDashoffset = 0;

  const interval = setInterval(() => {
    remaining--;

    // Update number
    countdownEl.textContent = remaining;

    // Update ring (fills as time passes)
    const offset = (1 - remaining / COUNTDOWN_SECONDS) * CIRCUMFERENCE;
    progressRing.style.strokeDashoffset = offset;

    if (remaining <= 0) {
      clearInterval(interval);
      countdownEl.textContent = "✓";
      countdownLabel.textContent = "You may now proceed (but think twice)";
      btnProceed.classList.remove("hidden");
    }
  }, 1000);

  // ── Actions ───────────────────────────────────────────────

  // Go back — close the tab or navigate back
  window.goBack = function () {
    // Try to go back in history, or close the tab
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  // Proceed anyway — log the override and navigate to the blocked URL
  window.proceedAnyway = function () {
    // Log the override
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: "logOverride",
        url: blockedUrl,
      });
    }

    // Navigate to the original URL
    // We need to temporarily disable blocking for this navigation.
    // The simplest approach: open the URL after a brief delay to let
    // the override message propagate, and use the redirect URL with
    // a bypass flag.
    if (blockedUrl) {
      window.location.href = blockedUrl;
    }
  };
})();
