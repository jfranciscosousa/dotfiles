let isAppWindow = false;

chrome.runtime.sendMessage({ type: "is-app-window" }, (response) => {
  if (chrome.runtime.lastError) return;
  isAppWindow = response?.isAppWindow === true;
});

function findLink(event) {
  return event.composedPath().find((element) => element?.localName === "a" && element.href);
}

function handleClick(event) {
  if (
    !isAppWindow ||
    !event.isTrusted ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return;
  }

  const link = findLink(event);
  if (!link || link.hasAttribute("download")) return;

  let target;
  try {
    target = new URL(link.href, location.href);
  } catch {
    return;
  }

  if (!["http:", "https:"].includes(target.protocol) || target.origin === location.origin) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  chrome.runtime.sendMessage({ type: "open-external-url", url: target.href }, (response) => {
    const error = chrome.runtime.lastError;
    if (error || !response?.opened) location.assign(target.href);
  });
}

document.addEventListener("click", handleClick, true);
