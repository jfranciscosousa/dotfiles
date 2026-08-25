const NATIVE_HOST = "com.jfranciscosousa.open_webapp_link";

async function isAppWindow(sender) {
  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) return false;

  try {
    const window = await chrome.windows.get(windowId, {
      windowTypes: ["app", "normal", "popup"],
    });
    return window.type === "app";
  } catch {
    return false;
  }
}

function parseWebUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "is-app-window") {
    void isAppWindow(sender).then((result) => {
      sendResponse({ isAppWindow: result });
    });
    return true;
  }

  if (message?.type === "open-external-url") {
    void (async () => {
      const url = parseWebUrl(message.url);
      if (!url || !(await isAppWindow(sender))) {
        sendResponse({ opened: false });
        return;
      }

      chrome.runtime.sendNativeMessage(NATIVE_HOST, { url: url.href }, (response) => {
        const error = chrome.runtime.lastError;
        sendResponse({ opened: !error && response?.opened === true });
      });
    })();
    return true;
  }

  return false;
});
