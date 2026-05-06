import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import MainView from "./components/MainView";
import Settings from "./components/Settings";
import HistoryView from "./components/HistoryView";

export default function App() {
  const NOW_PLAYING_FRESH_MS = 300000;
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("main"); // main, connection, display, history
  const [theme, setTheme] = useState(() => localStorage.getItem("trackcast-theme") || "night");
  const [currentTrack, setCurrentTrack] = useState(null);
  const [trackHistory, setTrackHistory] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [unboxConnected, setUnboxConnected] = useState(false);
  const [retryingConnection, setRetryingConnection] = useState(false);
  const [canExportCurrentSet, setCanExportCurrentSet] = useState(false);
  const [liveStartedAt, setLiveStartedAt] = useState(null);
  const [liveElapsedLabel, setLiveElapsedLabel] = useState("00:00");
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [lastTrackEventAt, setLastTrackEventAt] = useState(null);
  const [trackFreshTick, setTrackFreshTick] = useState(Date.now());
  const [traktorSetupStatus, setTraktorSetupStatus] = useState(null);
  const isTrackingRef = useRef(false);
  const connectTimeoutRef = useRef(null);

  const normalizeTrackValue = (v) => (v || "").trim().toLowerCase();
  const sameTrack = (a, b) =>
    normalizeTrackValue(a?.artist) === normalizeTrackValue(b?.artist) &&
    normalizeTrackValue(a?.title) === normalizeTrackValue(b?.title);

  const formatLiveElapsed = (ms) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    invoke("get_config")
      .then((cfg) => setConfig(cfg))
      .catch(() =>
        setConfig({
          telegram_token: "",
          telegram_chat_id: "",
          telegram_verified: false,
          telegram_verified_at: null,
          telegram_verified_fingerprint: null,
          dj_software: "",
          onboarding_done: false,
          set_name: "",
          message_template: "🎵 {artist} — {title}",
          show_bpm: true,
          show_key: false,
          session_messages_enabled: false,
          session_start_template: "is starting to play {set_name}",
          session_end_template: "just finished playing {set_name}",
        })
      );
  }, []);

  useEffect(() => {
    if (!config) return;
    if ((config.dj_software || "").trim() !== "traktor") {
      setTraktorSetupStatus(null);
      return;
    }

    let disposed = false;
    const refresh = async () => {
      try {
        const status = await invoke("get_traktor_setup_status");
        if (!disposed) setTraktorSetupStatus(status);
      } catch (_) {
        if (!disposed) {
          setTraktorSetupStatus({
            plugin_files_present: false,
            runtime_api_reachable: false,
            overall_ready: false,
            expected_version: "unbox-d2-v1",
            installed_version: null,
            version_match: false,
          });
        }
      }
    };

    refresh();
    const id = setInterval(refresh, 2500);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [config]);

  useEffect(() => {
    invoke("get_track_history")
      .then((tracks) => setCanExportCurrentSet(Array.isArray(tracks) && tracks.length > 0))
      .catch(() => setCanExportCurrentSet(false));
  }, []);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("trackcast-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isTracking || !liveStartedAt) {
      setLiveElapsedLabel("00:00");
      return;
    }
    setLiveElapsedLabel(formatLiveElapsed(Date.now() - liveStartedAt));
    const id = setInterval(() => {
      setLiveElapsedLabel(formatLiveElapsed(Date.now() - liveStartedAt));
    }, 1000);
    return () => clearInterval(id);
  }, [isTracking, liveStartedAt]);

  useEffect(() => {
    const id = setInterval(() => setTrackFreshTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unlisteners = [];
    let disposed = false;

    const registerListener = async (eventName, handler) => {
      const unlisten = await listen(eventName, handler);
      if (disposed) {
        unlisten();
        return;
      }
      unlisteners.push(unlisten);
    };

    registerListener("track-changed", (event) => {
      const incoming = event.payload;
      setCurrentTrack(incoming);
      setLastTrackEventAt(Date.now());
      if (!isTrackingRef.current) return;
      invoke("get_track_history")
        .then((tracks) => {
          const safeTracks = Array.isArray(tracks) ? tracks : [];
          setTrackHistory(safeTracks);
          setCanExportCurrentSet(safeTracks.length > 0);
        })
        .catch(() => {});
    });

    registerListener("unbox-status", (event) => {
      setUnboxConnected(event.payload);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    if (unboxConnected && retryingConnection) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setRetryingConnection(false);
    }
  }, [unboxConnected, retryingConnection]);

  const handleRetryConnection = async () => {
    setRetryingConnection(true);
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
    }
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

  const handleStartStop = async () => {
    if (actionBusy) return;
    if (isTracking) {
      setShowStopConfirm(true);
    } else {
      setActionBusy(true);
      try {
        await invoke("start_tracking");
        try {
          const receiverStatus = await invoke("get_unbox_status");
          setUnboxConnected(Boolean(receiverStatus));
        } catch (_) {}
        setIsTracking(true);
        setLiveStartedAt(Date.now());
        setLiveElapsedLabel("00:00");
        setTrackHistory([]);
        setCanExportCurrentSet(false);
      } catch (e) {
        alert(`Start failed: ${e}`);
      } finally {
        setActionBusy(false);
      }
    }
  };

  const handleConfirmStop = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await invoke("stop_tracking");
      setIsTracking(false);
      setLiveStartedAt(null);
      setLiveElapsedLabel("00:00");
      const tracks = await invoke("get_track_history");
      setCanExportCurrentSet(Array.isArray(tracks) && tracks.length > 0);
    } finally {
      setActionBusy(false);
      setShowStopConfirm(false);
    }
  };

  const handleExport = async () => {
    try {
      const txt = await invoke("export_set");
      const date = new Date().toISOString().split("T")[0];
      const filePath = await save({
        defaultPath: `TrackCast_Set_${date}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, txt);
      }
    } catch (_) {
      try {
        const txt = await invoke("export_set");
        await navigator.clipboard.writeText(txt);
      } catch (__) {}
    }
  };

  const handleSaveConfig = async (newConfig) => {
    const full = { ...newConfig, onboarding_done: true };
    const softwareChanged = (config?.dj_software || "") !== (full.dj_software || "");
    await invoke("save_config", { config: full });
    setConfig(full);
    if (softwareChanged) {
      setUnboxConnected(false);
    }
    if ((full.dj_software || "").trim() !== "traktor") {
      setTraktorSetupStatus(null);
    }
  };

  const handleToggleTheme = () => {
    document.documentElement.classList.add("theme-changing");
    setTheme((prev) => (prev === "day" ? "night" : "day"));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.classList.remove("theme-changing");
      });
    });
  };

  if (!config) return null;

  const softwareConfigured = Boolean((config.dj_software || "").trim());
  const traktorSelected = (config.dj_software || "").trim() === "traktor";
  const traktorSetupReady = !traktorSelected || Boolean(traktorSetupStatus?.overall_ready);
  const canStart = softwareConfigured && traktorSetupReady && !actionBusy;
  const hasFreshTrackEvent =
    lastTrackEventAt != null && (trackFreshTick - lastTrackEventAt) < NOW_PLAYING_FRESH_MS;

  const receiverConnecting = retryingConnection;
  const receiverReady = unboxConnected;
  const receiverCanConnect = softwareConfigured && traktorSetupReady && !receiverReady && !receiverConnecting && !actionBusy;
  const receiverStatusClass = receiverReady ? "green" : receiverConnecting ? "amber" : "";
  const receiverDotClass = receiverReady ? "green" : receiverConnecting ? "loading" : "";
  const receiverStatusLabel = receiverReady ? "Linked" : receiverConnecting ? "Pending" : "Connect";
  const traktorSetupHint = traktorSelected && !traktorSetupReady
    ? "Traktor setup incomplete — install helper + verify."
    : "";

  return (
    <>
      <div className="app">
        <div className="titlebar">
          <div className="titlebar-spacer" />
          <div className="titlebar-right">
            <button
              className={`settings-btn icon-only history-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab(activeTab === "history" ? "main" : "history")}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                <path d="M6 7.5h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M6 16.5h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <button className="settings-btn theme-btn" onClick={handleToggleTheme}>◐</button>
          </div>
        </div>

        <div className="shell-tabs">
          <button
            className={`shell-tab ${activeTab === "main" ? "active" : ""}`}
            onClick={() => setActiveTab("main")}
          >
            Live
          </button>
          <button
            className={`shell-tab ${activeTab === "connection" ? "active" : ""}`}
            onClick={() => setActiveTab("connection")}
          >
            Setup
          </button>
          <button
            className={`shell-tab ${activeTab === "display" ? "active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            Display
          </button>
          <div className="tabs-status-single">
            <button
              className={`sb-item sb-item-action ${receiverStatusClass} ${receiverCanConnect ? "clickable" : ""}`}
              onClick={receiverCanConnect ? handleRetryConnection : undefined}
              disabled={!receiverCanConnect}
              title={!receiverCanConnect && traktorSetupHint ? traktorSetupHint : undefined}
            >
              <div className={`sb-dot ${receiverDotClass}`} />
              <span>{receiverStatusLabel}</span>
            </button>
          </div>
        </div>

        {activeTab === "main" && (
          <MainView
            currentTrack={currentTrack}
            trackHistory={trackHistory}
            isTracking={isTracking}
            hasFreshTrackEvent={hasFreshTrackEvent}
            unboxConnected={unboxConnected}
            onStartStop={handleStartStop}
            onExport={handleExport}
            canExportCurrentSet={canExportCurrentSet}
            liveElapsedLabel={liveElapsedLabel}
            actionBusy={actionBusy}
            canStart={canStart}
            softwareConfigured={softwareConfigured}
            startDisabledReason={traktorSetupHint}
          />
        )}

        {activeTab === "connection" && (
          <div className="settings-view">
            <Settings
              config={config}
              onSave={handleSaveConfig}
              isTracking={isTracking}
              tab="connection"
              showTabBar={false}
              traktorSetupStatus={traktorSetupStatus}
            />
          </div>
        )}

        {activeTab === "display" && (
          <div className="settings-view settings-view-display">
            <Settings
              config={config}
              onSave={handleSaveConfig}
              isTracking={isTracking}
              tab="display"
              showTabBar={false}
              traktorSetupStatus={traktorSetupStatus}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="settings-view">
            <HistoryView />
          </div>
        )}
      </div>

      {showStopConfirm && (
        <div className="tc-modal-backdrop">
          <div className="tc-modal">
            <div className="tc-modal-header" />
            <div className="tc-modal-text">Stop broadcasting now?</div>
            <div className="tc-modal-actions">
              <button className="inline-btn" onClick={() => setShowStopConfirm(false)} disabled={actionBusy}>
                Cancel
              </button>
              <button className="inline-btn tc-danger-btn" onClick={handleConfirmStop} disabled={actionBusy}>
                {actionBusy ? "···" : "Stop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
