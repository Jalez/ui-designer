const LOGS_DIR = "/app/logs";
const MAX_LOG_FILES = 3;
let currentLogFile: string | null = null;
const DEBUG_LOGS_ENABLED = process.env.DEBUG_LOGS === "true";

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function ensureLogsDirAsync(): Promise<void> {
  if (typeof window !== "undefined") return;
  try {
    const fs = await import("fs");
    if (!fs.default.existsSync(LOGS_DIR)) {
      fs.default.mkdirSync(LOGS_DIR, { recursive: true });
    }
  } catch {}
}

async function cleanupOldLogsAsync(): Promise<void> {
  if (typeof window !== "undefined") return;
  try {
    const fs = await import("fs");
    const path = await import("path");
    if (!fs.default.existsSync(LOGS_DIR)) return;

    const files = fs.default.readdirSync(LOGS_DIR)
      .filter(f => f.startsWith("debug-") && f.endsWith(".jsonl"))
      .map(f => ({
        name: f,
        path: path.join(LOGS_DIR, f),
        time: fs.default.statSync(path.join(LOGS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    files.slice(MAX_LOG_FILES).forEach(f => {
      try {
        fs.default.unlinkSync(f.path);
      } catch {}
    });
  } catch {}
}

export async function initDebugLogger(): Promise<string> {
  if (typeof window !== "undefined") return "";
  
  await ensureLogsDirAsync();
  await cleanupOldLogsAsync();

  const fs = await import("fs");
  const path = await import("path");
  
  const timestamp = getTimestamp();
  currentLogFile = path.join(LOGS_DIR, `debug-${timestamp}.jsonl`);

  const startupLog = {
    ts: new Date().toISOString(),
    event: "LOGGER_INIT",
    data: { logFile: currentLogFile }
  };

  try {
    fs.default.appendFileSync(currentLogFile, JSON.stringify(startupLog) + "\n");
  } catch {}

  if (DEBUG_LOGS_ENABLED) {
    console.log(`[DEBUG-LOGGER] Initialized: ${currentLogFile}`);
  }

  return currentLogFile;
}

export interface DebugLogData {
  [key: string]: unknown;
}

export function logDebug(event: string, data: DebugLogData): void {
  const entry = {
    ts: new Date().toISOString(),
    event,
    data
  };

  if (DEBUG_LOGS_ENABLED) {
    console.log(`[DEBUG] ${event}:`, JSON.stringify(data));
  }

  if (typeof window === "undefined" && currentLogFile) {
    import("fs").then(fs => {
      try {
        fs.default.appendFileSync(currentLogFile!, JSON.stringify(entry) + "\n");
      } catch {}
    });
  }
}

export function logDebugClient(event: string, data: DebugLogData): void {
  console.log(`%c[DEBUG-CLIENT] ${event}`, "color: #00ff00; font-weight: bold;", data);
}

// Initialize on module load (server-side only)
if (typeof window === "undefined") {
  initDebugLogger();
}

export function getLogFilePath(): string | null {
  return currentLogFile;
}
