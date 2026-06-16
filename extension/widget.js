/* ============================================================
   Friction — Widget Timer Logic
   A minimal floating timer that polls the background for
   session state and displays the countdown.
   ============================================================ */

(function () {
  "use strict";

  const timerEl = document.getElementById("timer");
  const timerWrap = document.getElementById("timer-wrap");
  const inactiveMsg = document.getElementById("inactive-msg");

  function formatTime(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function update() {
    chrome.runtime.sendMessage({ action: "getSession" }, (session) => {
      if (chrome.runtime.lastError) {
        console.error("[Friction Widget]", chrome.runtime.lastError.message);
        return;
      }

      if (session && session.isActive && session.endTime > Date.now()) {
        const remaining = session.endTime - Date.now();
        timerEl.textContent = formatTime(remaining);
        timerWrap.classList.add("visible");
        inactiveMsg.classList.remove("visible");
      } else {
        timerWrap.classList.remove("visible");
        inactiveMsg.classList.add("visible");
      }
    });
  }

  // Poll every second
  update();
  setInterval(update, 1000);
})();
