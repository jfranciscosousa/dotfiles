function parseSnapshot(raw) {
  var snapshot = {
    cpuIdle: 0,
    cpuTotal: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    diskUsed: 0,
    diskTotal: 0,
    diskPercent: 0,
    rxBytes: 0,
    txBytes: 0,
    interfaceCount: 0,
    gpuAvailable: false,
    gpuPercent: 0,
    gpuMemoryUsedMiB: 0,
    gpuMemoryTotalMiB: 0,
    gpuTemperature: 0,
    gpuName: "",
  };

  var lines = String(raw || "").split("\n");
  for (var i = 0; i < lines.length; i++) {
    var fields = lines[i].split("\t");
    if (fields[0] === "cpu") {
      snapshot.cpuIdle = number(fields[1]);
      snapshot.cpuTotal = number(fields[2]);
    } else if (fields[0] === "memory") {
      snapshot.memoryUsed = number(fields[1]);
      snapshot.memoryTotal = number(fields[2]);
      snapshot.memoryPercent = number(fields[3]);
    } else if (fields[0] === "disk") {
      snapshot.diskUsed = number(fields[1]);
      snapshot.diskTotal = number(fields[2]);
      snapshot.diskPercent = number(fields[3]);
    } else if (fields[0] === "network") {
      snapshot.rxBytes = number(fields[1]);
      snapshot.txBytes = number(fields[2]);
      snapshot.interfaceCount = number(fields[3]);
    } else if (fields[0] === "gpu") {
      snapshot.gpuAvailable = true;
      snapshot.gpuPercent = number(fields[1]);
      snapshot.gpuMemoryUsedMiB = number(fields[2]);
      snapshot.gpuMemoryTotalMiB = number(fields[3]);
      snapshot.gpuTemperature = number(fields[4]);
      snapshot.gpuName = fields.slice(5).join(" ").trim();
    }
  }

  return snapshot;
}

function number(value) {
  var parsed = Number(value);
  return isFinite(parsed) ? parsed : 0;
}

function cpuPercent(previousIdle, previousTotal, idle, total) {
  var totalDelta = total - previousTotal;
  var idleDelta = idle - previousIdle;
  if (previousTotal <= 0 || totalDelta <= 0) return 0;
  return clampPercent(((totalDelta - idleDelta) * 100) / totalDelta);
}

function rate(previousBytes, bytes, elapsedSeconds) {
  if (previousBytes <= 0 || bytes < previousBytes || elapsedSeconds <= 0) return 0;
  return Math.max(0, (bytes - previousBytes) / elapsedSeconds);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, number(value)));
}

function formatBytes(bytes) {
  var value = Math.max(0, number(bytes));
  var units = ["B", "KiB", "MiB", "GiB", "TiB"];
  var index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  var digits = value >= 100 || index === 0 ? 0 : 1;
  return value.toFixed(digits) + " " + units[index];
}

function formatRate(bytesPerSecond) {
  return formatBytes(bytesPerSecond) + "/s";
}

function formatPercent(value) {
  return Math.round(clampPercent(value)) + "%";
}

function gpuMemoryPercent(usedMiB, totalMiB) {
  return totalMiB > 0 ? clampPercent((usedMiB * 100) / totalMiB) : 0;
}

if (typeof module !== "undefined") {
  module.exports = {
    parseSnapshot: parseSnapshot,
    cpuPercent: cpuPercent,
    rate: rate,
    clampPercent: clampPercent,
    formatBytes: formatBytes,
    formatRate: formatRate,
    formatPercent: formatPercent,
    gpuMemoryPercent: gpuMemoryPercent,
  };
}
