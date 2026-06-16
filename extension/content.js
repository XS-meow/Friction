/* ============================================================
   Friction — In-Page Floating Panel (Content Script)
   Injected into the active tab. Creates a draggable overlay
   that stays in the page even when switching focus.
   ============================================================ */

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__frictionPanelInjected) {
    // Toggle visibility
    const existing = document.getElementById("friction-root");
    if (existing) {
      const panel = existing.shadowRoot.getElementById("friction-panel");
      if (panel) {
        const isHidden = panel.style.display === "none";
        panel.style.display = isHidden ? "flex" : "none";
      }
    }
    return;
  }
  window.__frictionPanelInjected = true;

  // ── Create Shadow DOM host ─────────────────────────────────
  const host = document.createElement("div");
  host.id = "friction-root";
  host.style.cssText = "all:initial; position:fixed; z-index:2147483647; top:0; left:0; width:0; height:0; pointer-events:none;";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // ── Styles ─────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* ── Full Panel ──────────────────────────────────────── */
    #friction-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 300px;
      background: #0f0f14;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #e4e4e7;
      overflow: hidden;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(20px);
      animation: panelIn 0.25s ease-out;
    }

    @keyframes panelIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Drag Handle / Header ────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1rem;
      cursor: grab;
      user-select: none;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.02);
    }

    .header:active { cursor: grabbing; }

    .header-icon {
      width: 26px;
      height: 26px;
      border-radius: 7px;
      background: linear-gradient(135deg, rgba(120,60,255,0.25), rgba(255,60,120,0.25));
      border: 1px solid rgba(120,60,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }

    .header h1 {
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      flex: 1;
    }

    .header-actions {
      display: flex;
      gap: 0.25rem;
    }

    .header-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: rgba(255,255,255,0.05);
      color: #71717a;
      font-size: 0.7rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .header-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #e4e4e7;
    }

    /* ── Body ─────────────────────────────────────────────── */
    .body {
      padding: 0.85rem 1rem;
    }

    /* ── Status ───────────────────────────────────────────── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .status-label {
      font-size: 0.7rem;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.5rem;
      border-radius: 20px;
      font-size: 0.68rem;
      font-weight: 600;
    }

    .status-badge.inactive {
      background: rgba(113,113,122,0.15);
      color: #71717a;
    }

    .status-badge.active {
      background: rgba(34,197,94,0.12);
      color: #4ade80;
    }

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
    }

    /* ── Timer ────────────────────────────────────────────── */
    .timer-area {
      text-align: center;
      padding: 0.5rem 0;
      display: none;
    }

    .timer-area.visible {
      display: block;
    }

    .timer-value {
      font-size: 2rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #7c3aed, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.1;
    }

    .timer-sub {
      font-size: 0.65rem;
      color: #52525b;
      margin-top: 0.2rem;
    }

    /* ── Stats ────────────────────────────────────────────── */
    .stats-row {
      display: flex;
      gap: 0.4rem;
      margin: 0.6rem 0;
    }

    .stat {
      flex: 1;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 0.5rem;
      text-align: center;
    }

    .stat-value {
      font-size: 0.95rem;
      font-weight: 700;
    }

    .stat-label {
      font-size: 0.58rem;
      color: #52525b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 0.1rem;
    }

    /* ── Buttons ──────────────────────────────────────────── */
    .btn {
      width: 100%;
      padding: 0.6rem;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }

    .btn-start {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: white;
      box-shadow: 0 4px 15px rgba(124,58,237,0.25);
    }

    .btn-start:hover {
      box-shadow: 0 4px 20px rgba(124,58,237,0.4);
      transform: translateY(-1px);
    }

    .btn-end {
      background: rgba(239,68,68,0.1);
      color: #f87171;
      border: 1px solid rgba(239,68,68,0.2);
    }

    .btn-end:hover {
      background: rgba(239,68,68,0.15);
    }

    .hidden {
      display: none !important;
    }

    /* ── Mini Timer Widget ────────────────────────────────── */
    #friction-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f0f14;
      border: 1px solid rgba(124,58,237,0.25);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
      padding: 0.5rem 1rem;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      display: none;
      align-items: center;
      gap: 0.6rem;
      font-family: 'Inter', -apple-system, sans-serif;
      animation: widgetIn 0.2s ease-out;
    }

    #friction-widget:active { cursor: grabbing; }

    #friction-widget.visible { display: flex; }

    @keyframes widgetIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    .widget-timer {
      font-size: 1.5rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      background: linear-gradient(135deg, #7c3aed, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }

    .widget-close {
      width: 20px;
      height: 20px;
      border-radius: 5px;
      border: none;
      background: rgba(255,255,255,0.06);
      color: #71717a;
      font-size: 0.65rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }

    .widget-close:hover {
      background: rgba(239,68,68,0.15);
      color: #f87171;
    }
  `;
  shadow.appendChild(style);

  // ── Build DOM ──────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.id = "friction-panel";
  panel.innerHTML = `
    <div class="header" id="drag-handle">
      <div class="header-icon">🎯</div>
      <h1>Friction</h1>
      <div class="header-actions">
        <button class="header-btn" id="btn-minimize" title="Minimize to timer">⊟</button>
        <button class="header-btn" id="btn-close" title="Close">✕</button>
      </div>
    </div>
    <div class="body">
      <div class="status-row">
        <span class="status-label">Session</span>
        <span class="status-badge inactive" id="status-badge">
          <span class="dot"></span>
          <span id="status-text">Inactive</span>
        </span>
      </div>
      <div class="timer-area" id="timer-area">
        <div class="timer-value" id="timer-value">00:00</div>
        <div class="timer-sub">remaining</div>
      </div>
      <div class="stats-row">
        <div class="stat">
          <div class="stat-value" id="distractions-count">0</div>
          <div class="stat-label">Distractions</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="overrides-count">0</div>
          <div class="stat-label">Overrides</div>
        </div>
      </div>
      <button class="btn btn-start" id="btn-start">▶ Start 10-min session</button>
      <button class="btn btn-end hidden" id="btn-end">■ End session</button>
    </div>
  `;
  shadow.appendChild(panel);

  // ── Mini Widget ────────────────────────────────────────────
  const widget = document.createElement("div");
  widget.id = "friction-widget";
  widget.innerHTML = `
    <span class="widget-timer" id="widget-timer">00:00</span>
    <button class="widget-close" id="widget-expand" title="Expand">↗</button>
  `;
  shadow.appendChild(widget);

  // ── DOM refs inside shadow ─────────────────────────────────
  const $ = (sel) => shadow.getElementById(sel) || shadow.querySelector(sel);

  const statusBadge = $("status-badge");
  const statusText = $("status-text");
  const timerArea = $("timer-area");
  const timerValue = $("timer-value");
  const btnStart = $("btn-start");
  const btnEnd = $("btn-end");
  const btnClose = $("btn-close");
  const btnMinimize = $("btn-minimize");
  const dragHandle = $("drag-handle");
  const distractionsCount = $("distractions-count");
  const overridesCount = $("overrides-count");
  const widgetTimer = $("widget-timer");
  const widgetExpand = $("widget-expand");

  // ── Helpers ────────────────────────────────────────────────
  function formatTime(ms) {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ── Drag Logic ─────────────────────────────────────────────
  function makeDraggable(handle, target) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return; // Don't drag when clicking buttons
      isDragging = true;
      const rect = target.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      handle.style.cursor = "grabbing";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      target.style.left = Math.max(0, Math.min(x, window.innerWidth - 100)) + "px";
      target.style.top = Math.max(0, Math.min(y, window.innerHeight - 50)) + "px";
      target.style.right = "auto";
      target.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        handle.style.cursor = "grab";
      }
    });
  }

  makeDraggable(dragHandle, panel);
  makeDraggable(widget, widget);

  // ── Update UI ──────────────────────────────────────────────
  function updateUI(session) {
    if (session && session.isActive && session.endTime > Date.now()) {
      statusBadge.className = "status-badge active";
      statusText.textContent = "Active";
      timerArea.classList.add("visible");
      btnStart.classList.add("hidden");
      btnEnd.classList.remove("hidden");

      const remaining = session.endTime - Date.now();
      const timeStr = formatTime(remaining);
      timerValue.textContent = timeStr;
      widgetTimer.textContent = timeStr;
    } else {
      statusBadge.className = "status-badge inactive";
      statusText.textContent = "Inactive";
      timerArea.classList.remove("visible");
      btnStart.classList.remove("hidden");
      btnEnd.classList.add("hidden");
      widgetTimer.textContent = "00:00";
    }
  }

  // ── Load Stats ─────────────────────────────────────────────
  function loadStats() {
    chrome.storage.local.get(["distractionLog", "overrideLog"], (data) => {
      const distractions = data.distractionLog || [];
      const overrides = data.overrideLog || [];
      const today = new Date().toDateString();

      distractionsCount.textContent = distractions.filter(
        (d) => new Date(d.timestamp).toDateString() === today
      ).length;
      overridesCount.textContent = overrides.filter(
        (o) => new Date(o.timestamp).toDateString() === today
      ).length;
    });
  }

  // ── Polling ────────────────────────────────────────────────
  function refresh() {
    chrome.runtime.sendMessage({ action: "getSession" }, (session) => {
      if (chrome.runtime.lastError) return;
      updateUI(session);
    });
  }

  refresh();
  loadStats();
  setInterval(refresh, 1000);
  setInterval(loadStats, 10000);

  // ── Actions ────────────────────────────────────────────────
  btnStart.addEventListener("click", () => {
    btnStart.disabled = true;
    btnStart.textContent = "Starting...";
    chrome.runtime.sendMessage({ action: "startSession", duration: 10 }, (session) => {
      if (chrome.runtime.lastError) {
        console.error("[Friction]", chrome.runtime.lastError.message);
      } else {
        updateUI(session);
      }
      btnStart.disabled = false;
      btnStart.textContent = "▶ Start 10-min session";
    });
  });

  btnEnd.addEventListener("click", () => {
    btnEnd.disabled = true;
    btnEnd.textContent = "Ending...";
    chrome.runtime.sendMessage({ action: "endSession" }, (session) => {
      if (chrome.runtime.lastError) {
        console.error("[Friction]", chrome.runtime.lastError.message);
      } else {
        updateUI(session);
      }
      btnEnd.disabled = false;
      btnEnd.textContent = "■ End session";
    });
  });

  // Close panel
  btnClose.addEventListener("click", () => {
    panel.style.display = "none";
    widget.classList.remove("visible");
  });

  // Minimize to widget (timer only)
  btnMinimize.addEventListener("click", () => {
    panel.style.display = "none";
    widget.classList.add("visible");
  });

  // Expand widget back to full panel
  widgetExpand.addEventListener("click", (e) => {
    e.stopPropagation();
    widget.classList.remove("visible");
    panel.style.display = "flex";
  });
})();
