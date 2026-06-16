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
  const btnGoBack = document.getElementById("btn-go-back");

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

  // ── Actions (attached via addEventListener, not inline onclick) ─

  // Go back — navigate to new tab or close the tab
  btnGoBack.addEventListener("click", function () {
    // Since the page was loaded via redirect, history.back() would just
    // re-trigger the blocked redirect. Instead, navigate to a safe page
    // or close the tab.
    if (window.history.length > 1) {
      // Go back twice to skip the redirect entry
      window.history.go(-2);
    }
    // Fallback: replace with new tab page after a brief delay
    // (in case history.go didn't work or there's nothing to go back to)
    setTimeout(() => {
      // Try to close the tab; if that fails, navigate to new tab
      try {
        window.close();
      } catch {
        window.location.replace("chrome://newtab");
      }
    }, 200);
  });

  // Proceed anyway — log the override, wait for blocking to be disabled, then navigate
  btnProceed.addEventListener("click", function () {
    btnProceed.disabled = true;
    btnProceed.textContent = "Redirecting...";

    // Log the override (fire-and-forget, no need to wait)
    chrome.runtime.sendMessage({ action: "logOverride", url: blockedUrl });

    // Ask background to disable blocking, WAIT for confirmation, then navigate
    chrome.runtime.sendMessage(
      { action: "temporaryBypass", url: blockedUrl },
      function (response) {
        // Background has confirmed rules are removed — safe to navigate now
        if (blockedUrl) {
          window.location.replace(blockedUrl);
        }
      }
    );
  });
})();
