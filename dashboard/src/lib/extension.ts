/**
 * Chrome Extension messaging helpers.
 *
 * Uses chrome.runtime.sendMessage to communicate with the
 * Friction extension from the Next.js dashboard.
 */

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || "";

/**
 * Check if we're running in a Chrome browser that supports
 * extension messaging.
 */
function canMessage(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.runtime !== "undefined" &&
    typeof chrome.runtime.sendMessage === "function" &&
    !!EXTENSION_ID
  );
}

/**
 * Send a message to the Friction Chrome extension.
 * Returns the response, or null if the extension isn't available.
 */
export async function sendToExtension<T = unknown>(
  message: Record<string, unknown>
): Promise<T | null> {
  if (!canMessage()) {
    console.warn(
      "[Friction] Extension messaging unavailable. " +
        "Either not in Chrome, extension not installed, or EXTENSION_ID not set."
    );
    return null;
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(EXTENSION_ID, message, (response: T) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[Friction] Extension message failed:",
          chrome.runtime.lastError.message
        );
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Start a focus session in the extension.
 */
export async function startExtensionSession(
  durationMinutes: number
): Promise<unknown> {
  return sendToExtension({
    action: "startSession",
    duration: durationMinutes,
  });
}

/**
 * End the current session in the extension.
 */
export async function endExtensionSession(): Promise<unknown> {
  return sendToExtension({ action: "endSession" });
}

/**
 * Ping the extension to check if it's installed and responsive.
 */
export async function pingExtension(): Promise<boolean> {
  const response = await sendToExtension<{ pong: boolean }>({
    action: "ping",
  });
  return !!response?.pong;
}
