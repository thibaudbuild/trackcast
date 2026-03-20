import { useState, useEffect } from "react";
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

  const normalizeTrackValue = (v) => (v || "").trim().toLowerCase();
  const sameTrack = (a, b) =>
    normalizeTrackValue(a?.artist) === normalizeTrackValue(b?.artist) &&
    normalizeTrackValue(a?.title) === normalizeTrackValue(b?.title);

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
    setActionBusy(true);
    if (isTracking) {
      const confirmed = window.confirm("Stop broadcasting now?");
      if (!confirmed) {
        setActionBusy(false);
        return;
      }
      try {
        await invoke("stop_tracking");
        setIsTracking(false);
      } finally {
        setActionBusy(false);
      }
    } else {
      try {
        await invoke("start_tracking");
        setIsTracking(true);
        setTrackHistory([]);
      } finally {
        setActionBusy(false);
      }
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
    await invoke("save_config", { config: full });
    setConfig(full);
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
      actionBusy={actionBusy}
    />
  );
}
