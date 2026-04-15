import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";

const AUTH_DIR = path.resolve(process.cwd(), ".wa-auth");

const state = {
  status: "disconnected", // disconnected | connecting | qr | connected
  qrDataUrl: "",
  me: "",
  lastError: "",
  lastErrorDetail: null,
  socket: null,
  connectPromise: null,
  reconnectTimer: null,
  baileysVersion: null,
};

const normalizeWaPhoneId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  return digits.startsWith("62") ? digits : null;
};

const setStatus = (status) => {
  state.status = status;
};

const getSnapshot = () => ({
  status: state.status,
  qrDataUrl: state.qrDataUrl,
  me: state.me,
  lastError: state.lastError,
  lastErrorDetail: state.lastErrorDetail,
});

const clearReconnect = () => {
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
};

const startSocket = async () => {
  await fs.mkdir(AUTH_DIR, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  if (!state.baileysVersion) {
    try {
      const { version } = await fetchLatestBaileysVersion();
      state.baileysVersion = version;
    } catch {
      state.baileysVersion = null;
    }
  }

  const sock = makeWASocket({
    printQRInTerminal: false,
    auth: authState,
    browser: ["Barbershop", "Chrome", "1.0.0"],
    ...(state.baileysVersion ? { version: state.baileysVersion } : {}),
  });

  state.socket = sock;
  state.lastError = "";
  state.lastErrorDetail = null;
  state.qrDataUrl = "";
  state.me = "";

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    void (async () => {
      if (update.qr) {
        try {
          state.qrDataUrl = await QRCode.toDataURL(update.qr, { margin: 1, width: 280 });
        } catch (err) {
          state.qrDataUrl = "";
          state.lastError = err instanceof Error ? err.message : String(err);
          state.lastErrorDetail = { message: state.lastError };
        }
        state.me = "";
        setStatus("qr");
      }

      if (update.connection === "connecting") {
        setStatus("connecting");
      }

      if (update.connection === "open") {
        state.qrDataUrl = "";
        state.me = sock?.user?.id ? String(sock.user.id) : "";
        state.lastError = "";
        state.lastErrorDetail = null;
        setStatus("connected");
        clearReconnect();
      }

      if (update.connection === "close") {
        const statusCode = update?.lastDisconnect?.error?.output?.statusCode;
        const lastErr = update?.lastDisconnect?.error;
        const lastMessage = lastErr?.message || lastErr?.toString?.() || "";
        const detail = {
          message: lastMessage || "",
          statusCode: statusCode || null,
          stack: lastErr?.stack || null,
          data: lastErr?.data || null,
        };
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        state.me = "";
        state.socket = null;

        if (loggedOut) {
          state.qrDataUrl = "";
          state.lastError = lastMessage || `Logged out (code ${statusCode || "-"})`;
          state.lastErrorDetail = detail;
          setStatus("disconnected");
        } else {
          state.lastError = lastMessage || `Disconnected (code ${statusCode || "-"})`;
          state.lastErrorDetail = detail;
          setStatus("disconnected");
          scheduleReconnect();
        }
      }
    })().catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err);
      state.lastErrorDetail = { message: state.lastError, stack: err?.stack || null };
      setStatus("disconnected");
    });
  });

  sock.ev.on("messages.upsert", () => {
    // no-op (keep event loop alive; useful for some runtimes)
  });
};

const connectInternal = async () => {
  if (state.status === "connected") return { status: state.status, me: state.me, lastError: state.lastError };
  if (state.connectPromise) return state.connectPromise;
  setStatus("connecting");
  state.connectPromise = (async () => {
    try {
      await startSocket();
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err);
      setStatus("disconnected");
    } finally {
      state.connectPromise = null;
    }
    return { status: state.status, me: state.me, lastError: state.lastError };
  })();
  return state.connectPromise;
};

const waitForQrOrConnected = async ({ timeoutMs = 20000 } = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (state.status === "qr" && state.qrDataUrl) return getSnapshot();
    if (state.status === "connected") return getSnapshot();
    if (state.status === "disconnected" && state.lastError) return getSnapshot();
    await new Promise((r) => setTimeout(r, 250));
  }
  return getSnapshot();
};

const scheduleReconnect = () => {
  clearReconnect();
  state.reconnectTimer = setTimeout(() => {
    void connectInternal().catch(() => null);
  }, 3000);
};

export const waGateway = {
  normalizeWaPhoneId,
  getStatus: () => ({ status: state.status, me: state.me, lastError: state.lastError }),
  getState: () => getSnapshot(),
  getQrDataUrl: () => state.qrDataUrl,

  connect: async ({ wait = false } = {}) => {
    await connectInternal();
    return wait ? waitForQrOrConnected() : getSnapshot();
  },

  ensureQr: async ({ timeoutMs = 20000 } = {}) => {
    if (state.status === "connected") return getSnapshot();
    const first = await connectInternal().then(() => waitForQrOrConnected({ timeoutMs }));
    if (first.status === "qr" && first.qrDataUrl) return first;
    if (first.status === "connected") return first;

    // If we have auth state but connection fails, force fresh session to get QR.
    await waGateway.logout();
    await connectInternal();
    return waitForQrOrConnected({ timeoutMs });
  },

  logout: async () => {
    clearReconnect();
    try {
      if (state.socket) {
        await state.socket.logout();
      }
    } catch {
      // ignore
    }
    state.socket = null;
    state.qrDataUrl = "";
    state.me = "";
    setStatus("disconnected");
    try {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return waGateway.getStatus();
  },

  sendText: async (phone, text) => {
    const normalized = normalizeWaPhoneId(phone);
    if (!normalized) return false;
    if (!state.socket || state.status !== "connected") return false;
    try {
      const jid = `${normalized}@s.whatsapp.net`;
      await state.socket.sendMessage(jid, { text: String(text || "") });
      return true;
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : String(err);
      return false;
    }
  },
};
