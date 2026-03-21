import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DJ_OPTIONS = [
  { value: "rekordbox", label: "Rekordbox",       needsInit: false },
  { value: "serato",    label: "Serato DJ Pro",   needsInit: false },
  { value: "traktor",   label: "Traktor Pro 3",   needsInit: false },
  { value: "virtualdj", label: "VirtualDJ",       needsInit: false },
  { value: "mixxx",     label: "Mixxx",           needsInit: false },
  { value: "djuced",    label: "DJUCED",          needsInit: false },
  { value: "djay",      label: "djay Pro",        needsInit: false },
  { value: "denon",     label: "Denon DJ",        needsInit: false },
];

export default function MainView({
  config,
  currentTrack,
  trackHistory,
  isTracking,
  unboxConnected,
  telegramStatus,
  onStartStop,
  onExport,
  onSettings,
  onHistory,
  onConfigChange,
  canExportCurrentSet,
  actionBusy,
}) {
  const telegramFingerprint = (token, chatId) =>
    `${(token || "").trim()}::${(chatId || "").trim()}`;

  // Progressive unlock state
  const [software, setSoftware]       = useState(config.dj_software || "");
  const [softwareLocked, setSoftwareLocked] = useState(!!config.dj_software);
  const [initDone, setInitDone]       = useState(!!config.dj_software);
  const [retryingConnection, setRetryingConnection] = useState(false);
  const connectTimeoutRef = useRef(null);

  useEffect(() => {
    setSoftware(config.dj_software || "");
    setSoftwareLocked(!!config.dj_software);
    setInitDone(!!config.dj_software);
  }, [config]);

  const selectedSw = DJ_OPTIONS.find((d) => d.value === software);
  const softwareDisplayLabel =
    selectedSw?.label ||
    DJ_OPTIONS.find((d) => d.value === config.dj_software)?.label ||
    "DJ software";
  const softwareReadOnly = isTracking || softwareLocked;
  const isReady = softwareLocked && initDone;

  const handleSoftwareChange = (e) => {
    if (isTracking) return;
    setSoftware(e.target.value);
    setSoftwareLocked(false);
    setInitDone(false);
  };

  const handleSoftwareLock = async () => {
    if (isTracking) return;
    if (!software) return;
    setSoftwareLocked(true);
    const sw = DJ_OPTIONS.find((d) => d.value === software);
    if (sw && !sw.needsInit) {
      setInitDone(true); // auto-skip init for non-Traktor
    }
    await onConfigChange({ ...config, dj_software: software });
  };

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }
    // Failsafe: release button if backend never flips status.
    connectTimeoutRef.current = setTimeout(() => {
      setRetryingConnection(false);
      connectTimeoutRef.current = null;
    }, 12000);
    try {
      await invoke("retry_connection");
    } catch (e) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setRetryingConnection(false);
      alert(`Retry failed: ${e}`);
    }
  };

  useEffect(() => {
    if (unboxConnected && retryingConnection) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setRetryingConnection(false);
    }
  }, [unboxConnected, retryingConnection]);

  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
    };
  }, []);

  const telegramCurrentFp = telegramFingerprint(config.telegram_token, config.telegram_chat_id);
  const telegramConnected = Boolean(
    config.telegram_verified &&
    telegramCurrentFp !== "::" &&
    (
      config.telegram_verified_fingerprint === telegramCurrentFp ||
      !config.telegram_verified_fingerprint
    )
  );
  const telegramStatusClass =
    telegramStatus === "sent" ? "amber" :
    telegramStatus === "error" ? "red" :
    telegramConnected ? "green" : "";
  const telegramDotClass =
    telegramStatus === "sent" ? "amber pulse" :
    telegramStatus === "error" ? "red" :
    telegramConnected ? "green" : "";

  return (
    <div className="app">
      {/* ── Titlebar ──────────────────────────── */}
      <div className="titlebar">
        <span className="titlebar-name">TrackCast</span>
        <div className="titlebar-right">
          <button className="settings-btn icon-only" onClick={onHistory} title="History">
            <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
              <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 17.5v1.8c0 1.5 1.2 2.7 2.7 2.7h8.6c1.5 0 2.7-1.2 2.7-2.7v-1.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="settings-btn" onClick={onSettings} title="Settings">
            ⚙
          </button>
        </div>
      </div>

      {/* ── Status bar (only when ready) ─────── */}
      {isReady && (
        <div className="statusbar">
          <div className={`sb-item ${unboxConnected ? "green" : ""}`}>
            <div className={`sb-dot ${unboxConnected ? "green" : "pulse"}`} />
            {selectedSw?.label || "DJ Software"}
          </div>
          <div className={`sb-item ${telegramStatusClass}`}>
            <div className={`sb-dot ${telegramDotClass}`} />
            Telegram
          </div>
          <div className="sb-spacer" />
        </div>
      )}

      {/* ── Row 01: DJ Software ───────────────── */}
      <div className={`row ${softwareReadOnly ? "done" : "active"}`}>
        <div className="row-label">
          <span className="row-num">01</span>
          DJ Software
          <div className={`row-status ${softwareReadOnly ? "on" : ""}`} />
        </div>
        {softwareReadOnly ? (
          <div className="select-locked">
            <span className="select-check">✓</span>
            <span>{softwareDisplayLabel}</span>
          </div>
        ) : (
          <div className="input-row">
            <select
              className="tc-select"
              value={software}
              onChange={handleSoftwareChange}
            >
              <option value="">Select DJ software...</option>
              {DJ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              className="inline-btn"
              onClick={handleSoftwareLock}
              disabled={!software}
            >
              confirm
            </button>
          </div>
        )}
      </div>

      {/* ── Row 02: Receiver status ───────────────────── */}
      {softwareLocked && (
        <div className={`row ${unboxConnected ? "done" : "active"}`}>
          <div className="row-label">
            <span className="row-num">02</span>
            Track Receiver
            <div className={`row-status ${unboxConnected ? "on" : ""}`} />
          </div>
          <div className="input-row">
            <div className="select-locked" style={{ flex: 1 }}>
              <span className="select-check">{unboxConnected ? "✓" : "·"}</span>
              <span>{unboxConnected ? "Ready" : "Not ready"}</span>
            </div>
            {!unboxConnected && (
              <button
                className={`inline-btn ${retryingConnection ? "busy" : ""}`}
                onClick={handleRetryConnection}
                disabled={retryingConnection || !softwareLocked || actionBusy}
              >
                {retryingConnection ? "connecting" : "connect"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Now Playing ───────────────────────── */}
      <div className="now-playing">
        {currentTrack ? (
          <>
            <div className="np-eyebrow">
              <div className="np-eyebrow-dot" />
              now playing
            </div>
            <div className="np-artist">{currentTrack.artist || "Unknown Artist"}</div>
            <div className="np-title">{currentTrack.title || "Unknown Track"}</div>
            <div className="np-tags">
              {currentTrack.bpm && (
                <span className="np-tag amber">{Math.round(currentTrack.bpm)} BPM</span>
              )}
              {currentTrack.key && (
                <span className="np-tag">{currentTrack.key}</span>
              )}
              {currentTrack.label && (
                <span className="np-tag">{currentTrack.label}</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="np-empty-eye">Waiting for track</div>
            <div className="np-artist empty">—</div>
            <div className="np-title empty">
              {isReady ? "Play a track in your DJ software" : "Complete setup above"}
            </div>
          </>
        )}
      </div>

      {/* ── Controls ─────────────────────────── */}
      <div className="controls-bar">
        {isTracking ? (
          <>
            <button className="btn-broadcast stop" onClick={onStartStop} disabled={actionBusy}>
              ■ &nbsp;Stop
            </button>
            <div className="live-badge">
              <div className="live-dot" />
              LIVE
            </div>
          </>
        ) : (
          <button
            className="btn-broadcast start"
            onClick={onStartStop}
            disabled={!isReady || actionBusy}
          >
            ▶ &nbsp;Start broadcasting
          </button>
        )}
        <button
          className="btn-ghost"
          onClick={onExport}
          disabled={isTracking || !canExportCurrentSet}
          title={!canExportCurrentSet ? "No active set to export" : undefined}
          style={{ marginLeft: "auto" }}
        >
          Export set
        </button>
      </div>

      {/* ── Set log ──────────────────────────── */}
      <div className="log-header">
        <span className="log-label">Set log</span>
        <span className="log-count">{trackHistory.length} tracks</span>
      </div>

      <div className="log-list">
        {trackHistory.length === 0 ? (
          <div className="log-empty">
            {isTracking ? "Tracks will appear here..." : "—"}
          </div>
        ) : (
          trackHistory.map((track, i) => (
            <div key={i} className={`log-item ${i === 0 ? "current" : ""}`}>
              <span className="log-time">{track.time}</span>
              <div className="log-track">
                <div className="log-artist">{track.artist || "Unknown"}</div>
                <div className="log-title">{track.title || "Unknown"}</div>
              </div>
              {track.bpm && (
                <span className="log-bpm">{Math.round(track.bpm)}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
