import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import MainView from "./components/MainView";
import Settings from "./components/Settings";
import HistoryView from "./components/HistoryView";

export default function App() {
  const [config, setConfig] = useState(null);
  const [view, setView] = useState("main"); // main, settings, history
  const [currentTrack, setCurrentTrack] = useState(null);
  const [trackHistory, setTrackHistory] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [unboxConnected, setUnboxConnected] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("idle"); // idle, sent, error
  const [canExportCurrentSet, setCanExportCurrentSet] = useState(false);
  const [liveStartedAt, setLiveStartedAt] = useState(null);
  const [liveElapsedLabel, setLiveElapsedLabel] = useState("00:00");
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const isTrackingRef = useRef(false);

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

  // Load config on mount
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

  // Export availability depends on current in-memory set, not history files.
  useEffect(() => {
    invoke("get_track_history")
      .then((tracks) => setCanExportCurrentSet(Array.isArray(tracks) && tracks.length > 0))
      .catch(() => setCanExportCurrentSet(false));
  }, []);

  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

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

  // Listen to backend events
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
      if (!isTrackingRef.current) return;
      const incoming = event.payload;
      setCurrentTrack(incoming);
      setTrackHistory((prev) => {
        if (prev.length > 0 && sameTrack(incoming, prev[0])) {
          return prev;
        }
        return [
          {
            ...incoming,
            time: new Date().toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ];
      });
      invoke("get_track_history")
        .then((tracks) => setCanExportCurrentSet(Array.isArray(tracks) && tracks.length > 0))
        .catch(() => {});
    });

    registerListener("unbox-status", (event) => {
      setUnboxConnected(event.payload);
    });

    registerListener("telegram-sent", () => {
      setTelegramStatus("sent");
      setTimeout(() => setTelegramStatus("idle"), 3000);
    });

    registerListener("telegram-error", () => {
      setTelegramStatus("error");
      setTimeout(() => setTelegramStatus("idle"), 5000);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  const handleStartStop = async () => {
    if (actionBusy) return;
    if (isTracking) {
      setShowStopConfirm(true);
    } else {
      setActionBusy(true);
      try {
        await invoke("start_tracking");
        setIsTracking(true);
        setLiveStartedAt(Date.now());
        setLiveElapsedLabel("00:00");
        setCurrentTrack(null);
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
      setCurrentTrack(null);
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
      // fallback: clipboard
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
    setView("main");
  };

  if (!config) return null;

  if (view === "settings") {
    return (
      <div className="app">
        <div className="titlebar">
          <span className="titlebar-name">TrackCast</span>
          <div className="titlebar-right">
            <button className="settings-btn" onClick={() => setView("main")}>✕</button>
          </div>
        </div>
        <div className="settings-view">
          <Settings config={config} onSave={handleSaveConfig} isTracking={isTracking} />
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="app">
        <div className="titlebar">
          <span className="titlebar-name">TrackCast</span>
          <div className="titlebar-right">
            <button className="settings-btn" onClick={() => setView("main")}>✕</button>
          </div>
        </div>
        <div className="settings-view">
          <HistoryView />
        </div>
      </div>
    );
  }

  return (
    <>
      <MainView
        config={config}
        currentTrack={currentTrack}
        trackHistory={trackHistory}
        isTracking={isTracking}
        unboxConnected={unboxConnected}
        telegramStatus={telegramStatus}
        onStartStop={handleStartStop}
        onExport={handleExport}
        onSettings={() => setView("settings")}
        onHistory={() => setView("history")}
        onConfigChange={handleSaveConfig}
        canExportCurrentSet={canExportCurrentSet}
        liveElapsedLabel={liveElapsedLabel}
        actionBusy={actionBusy}
      />
      {showStopConfirm && (
        <div className="tc-modal-backdrop">
          <div className="tc-modal">
            <div className="tc-modal-title">Stop Live</div>
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
