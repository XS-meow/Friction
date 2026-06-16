/* ============================================================
   Friction — Background Service Worker
   Handles session lifecycle, site blocking, and cross-context
   communication with the Next.js dashboard.
   ============================================================ */

// ── Blocked Domains ──────────────────────────────────────────
// Each entry becomes a dynamic declarativeNetRequest rule that
// redirects matching navigations to blocked.html
const BLOCKED_DOMAINS = [
  "instagram.com",
  "www.instagram.com",
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  "reddit.com",
  "www.reddit.com",
  "youtube.com",
  "www.youtube.com",
  "tiktok.com",
  "www.tiktok.com",
  "facebook.com",
  "www.facebook.com",
];

// Rule IDs start at 1 and increment per domain
const RULE_ID_OFFSET = 1;
const SESSION_ALARM_NAME = "friction-session-end";

// ── Helpers ──────────────────────────────────────────────────

/**
 * Build a dynamic redirect rule for a given domain.
 * The rule intercepts main_frame navigations and redirects to
 * our local blocked.html with the original URL as a query param.
 */
function buildRule(domain, ruleId) {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        // regexSubstitution supports back-references from regexFilter
        regexSubstitution: chrome.runtime.getURL("blocked.html") + "?url=\\0",
      },
    },
    condition: {
      regexFilter: `^https?://(www\\.)?${domain.replace(/\./g, "\\.")}(/.*)?$`,
      resourceTypes: ["main_frame"],
    },
  };
}

/**
 * Generate rules for all blocked domains.
 */
function buildAllRules() {
  return BLOCKED_DOMAINS.map((domain, index) =>
    buildRule(domain, RULE_ID_OFFSET + index)
  );
}

/**
 * Get all rule IDs we manage.
 */
function getAllRuleIds() {
  return BLOCKED_DOMAINS.map((_, index) => RULE_ID_OFFSET + index);
}

// ── Session Management ───────────────────────────────────────

/**
 * Start a focus session.
 * @param {number} durationMinutes — session length in minutes
 */
async function startSession(durationMinutes) {
  const now = Date.now();
  const endTime = now + durationMinutes * 60 * 1000;

  const session = {
    isActive: true,
    startTime: now,
    durationMinutes,
    endTime,
  };

  // Persist session state
  await chrome.storage.local.set({ session });

  // Set alarm for auto-end
  await chrome.alarms.create(SESSION_ALARM_NAME, {
    when: endTime,
  });

  // Activate blocking rules
  await enableBlocking();

  console.log(
    `[Friction] Session started: ${durationMinutes}min, ends at ${new Date(endTime).toLocaleTimeString()}`
  );

  return session;
}

/**
 * End the current focus session (manual or alarm-triggered).
 */
async function endSession() {
  // Clear alarm
  await chrome.alarms.clear(SESSION_ALARM_NAME);

  // Remove blocking rules
  await disableBlocking();

  // Update storage
  const { session } = await chrome.storage.local.get("session");
  if (session) {
    session.isActive = false;
    session.endTime = Date.now();
    await chrome.storage.local.set({ session });
  }

  console.log("[Friction] Session ended.");
  return session;
}

/**
 * Get current session state from storage.
 */
async function getSession() {
  const { session } = await chrome.storage.local.get("session");
  return session || { isActive: false };
}

// ── Blocking Rules ───────────────────────────────────────────

/**
 * Add dynamic redirect rules for all blocked domains.
 */
async function enableBlocking() {
  const rules = buildAllRules();
  const ruleIds = getAllRuleIds();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds, // Remove existing first to avoid duplicates
    addRules: rules,
  });

  console.log(`[Friction] Blocking enabled: ${rules.length} rules active.`);
}

/**
 * Remove all dynamic redirect rules.
 */
async function disableBlocking() {
  const ruleIds = getAllRuleIds();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ruleIds,
  });

  console.log("[Friction] Blocking disabled.");
}

// ── Distraction Logging ──────────────────────────────────────

/**
 * Log a distraction attempt (when user hits a blocked site).
 */
async function logDistraction(url) {
  const { distractionLog = [] } = await chrome.storage.local.get("distractionLog");

  distractionLog.push({
    url,
    timestamp: Date.now(),
    date: new Date().toISOString(),
  });

  // Keep only last 500 entries to avoid storage bloat
  if (distractionLog.length > 500) {
    distractionLog.splice(0, distractionLog.length - 500);
  }

  await chrome.storage.local.set({ distractionLog });
  console.log(`[Friction] Distraction logged: ${url}`);
}

/**
 * Log when a user overrides the block (clicks "Proceed anyway").
 */
async function logOverride(url) {
  const { overrideLog = [] } = await chrome.storage.local.get("overrideLog");

  overrideLog.push({
    url,
    timestamp: Date.now(),
    date: new Date().toISOString(),
  });

  if (overrideLog.length > 500) {
    overrideLog.splice(0, overrideLog.length - 500);
  }

  await chrome.storage.local.set({ overrideLog });
  console.log(`[Friction] Override logged: ${url}`);
}

// ── Event Listeners ──────────────────────────────────────────

// Alarm fires → end session automatically
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_ALARM_NAME) {
    console.log("[Friction] Session alarm fired.");
    endSession();
  }
});

// Internal messages (from popup.js, blocked.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.action) {
      case "startSession":
        return await startSession(message.duration || 10);

      case "endSession":
        return await endSession();

      case "getSession":
        return await getSession();

      case "logDistraction":
        await logDistraction(message.url);
        return { success: true };

      case "logOverride":
        await logOverride(message.url);
        return { success: true };

      case "getDistractionLog":
        const { distractionLog = [] } = await chrome.storage.local.get("distractionLog");
        return distractionLog;

      case "temporaryBypass": {
        // Disable blocking rules — caller will navigate after receiving response
        await disableBlocking();

        // Re-enable blocking after a delay (5 seconds to allow page to load)
        setTimeout(async () => {
          const currentSession = await getSession();
          if (currentSession.isActive && currentSession.endTime > Date.now()) {
            await enableBlocking();
            console.log("[Friction] Blocking re-enabled after temporary bypass.");
          }
        }, 5000);
        return { success: true };
      }

      default:
        return { error: "Unknown action" };
    }
  };

  handler().then(sendResponse);
  return true; // Keep message channel open for async response
});

// External messages (from Next.js dashboard)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("[Friction] External message received:", message, "from:", sender.origin);

  const handler = async () => {
    switch (message.action) {
      case "startSession":
        return await startSession(message.duration || 10);

      case "endSession":
        return await endSession();

      case "getSession":
        return await getSession();

      case "ping":
        return { pong: true, version: chrome.runtime.getManifest().version };

      default:
        return { error: "Unknown action" };
    }
  };

  handler().then(sendResponse);
  return true;
});

// On install/update, make sure blocking state matches stored session
chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Friction] Extension installed/updated.");

  const session = await getSession();
  if (session.isActive && session.endTime > Date.now()) {
    // Restore blocking if there's an active session
    await enableBlocking();
    await chrome.alarms.create(SESSION_ALARM_NAME, {
      when: session.endTime,
    });
    console.log("[Friction] Restored active session from storage.");
  } else if (session.isActive) {
    // Session expired while extension was off
    await endSession();
  }
});

// Log distraction attempts via declarativeNetRequest action tracking
// This fires when a rule redirects a request
chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  if (info.request && info.request.url) {
    logDistraction(info.request.url);
  }
});

// ── In-Page Panel (Content Script Injection) ─────────────────

async function injectPanel(tabId) {
  if (!tabId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("about:")) {
      return;
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (err) {
    // Ignore errors for restricted tabs
  }
}

// Auto-inject on tab switch if panel is globally visible
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { frictionPanelState } = await chrome.storage.local.get("frictionPanelState");
  if (frictionPanelState?.isVisible) {
    injectPanel(activeInfo.tabId);
  }
});

// Auto-inject on page load if panel is globally visible
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const { frictionPanelState } = await chrome.storage.local.get("frictionPanelState");
    if (frictionPanelState?.isVisible) {
      injectPanel(tabId);
    }
  }
});

// Toggle global visibility on extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  
  const { frictionPanelState } = await chrome.storage.local.get("frictionPanelState");
  const isVisible = !(frictionPanelState?.isVisible);
  
  const newState = {
    ...(frictionPanelState || { mode: 'full', position: { top: '16px', left: 'auto', right: '16px' }, widgetPosition: { top: 'auto', left: 'auto', bottom: '20px', right: '20px' } }),
    isVisible
  };
  
  await chrome.storage.local.set({ frictionPanelState: newState });

  if (isVisible) {
    injectPanel(tab.id);
  }
});
