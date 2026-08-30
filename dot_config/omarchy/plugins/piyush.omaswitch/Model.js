var maxDisplayLength = 160;

function boundedText(value) {
  value = String(value || "");
  return value.length > maxDisplayLength ? value.slice(0, maxDisplayLength - 1) + "…" : value;
}

function appId(window) {
  if (!window) return "";
  if (window.wayland && window.wayland.appId) return String(window.wayland.appId);
  var ipc = window.lastIpcObject || {};
  return String(ipc.class || ipc.initialClass || "");
}

function label(window) {
  return boundedText(window && window.title ? window.title : appId(window) || "Untitled");
}

function detail(window) {
  if (!window) return "";
  var value = appId(window);
  if (window.workspace) value += (value ? " · " : "") + "ws " + String(window.workspace.id);
  return boundedText(value);
}

function workspaceRank(window) {
  var raw = window && window.workspace ? Number(window.workspace.id) : NaN;
  return isFinite(raw) && raw >= 0 ? raw : 1000000;
}

function position(window, axis) {
  var ipc = window && window.lastIpcObject ? window.lastIpcObject : {};
  var coordinates = ipc.at || (window && window.at);
  var value = coordinates && coordinates.length > axis ? Number(coordinates[axis]) : NaN;
  return isFinite(value) ? value : 1000000;
}

// Sort workspaces numerically from 1 through N. Within each workspace, sort
// windows spatially from left to right, then top to bottom for equal x values.
function sortedWindows(values) {
  var source = values && typeof values.slice === "function" ? values.slice() : [];
  var decorated = [];
  for (var i = 0; i < source.length; i++) {
    // Ignore foreign toplevel helper surfaces that have no Hyprland client.
    if (!source[i] || !source[i].address) continue;
    decorated.push({ value: source[i], index: i });
  }
  decorated.sort(function (left, right) {
    return (
      workspaceRank(left.value) - workspaceRank(right.value) ||
      position(left.value, 0) - position(right.value, 0) ||
      position(left.value, 1) - position(right.value, 1) ||
      left.index - right.index
    );
  });
  var result = [];
  for (var j = 0; j < decorated.length; j++) result.push(decorated[j].value);
  return result;
}

function currentIndex(values) {
  for (var i = 0; i < values.length; i++) {
    if (values[i] && values[i].activated) return i;
  }
  return -1;
}

function filteredWindows(values, query) {
  var q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return values.slice();
  return values.filter(function (window) {
    return (label(window) + " " + detail(window)).toLowerCase().indexOf(q) !== -1;
  });
}

// Build the shell command that focuses a window AND moves to its workspace.
// Native toplevel activate does not always switch the visible workspace, so
// the switch is requested explicitly: prefer Omarchy's Lua dispatcher form
// (hl.dsp.focus), fall back to the plain focuswindow syntax for stock
// Hyprland. Returns null when the window has no address, deferring to the
// native activate path in Switcher.qml.
function focusCommand(window) {
  var raw = window && window.address;
  if (raw === null || raw === undefined || raw === "") return null;
  var rawAddress = String(raw);
  var address = rawAddress.indexOf("0x") === 0 ? rawAddress : "0x" + rawAddress;
  return (
    "hyprctl dispatch \"hl.dsp.focus({ window = 'address:" +
    address +
    '\' })" >/dev/null 2>&1 || hyprctl dispatch focuswindow "address:' +
    address +
    '"'
  );
}

if (typeof module !== "undefined")
  module.exports = {
    appId: appId,
    label: label,
    detail: detail,
    sortedWindows: sortedWindows,
    currentIndex: currentIndex,
    filteredWindows: filteredWindows,
    focusCommand: focusCommand,
  };
