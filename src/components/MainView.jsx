export default function MainView({
  currentTrack,
  trackHistory,
  isTracking,
  hasFreshTrackEvent,
  unboxConnected,
  onStartStop,
  onExport,
  canExportCurrentSet,
  liveElapsedLabel,
  actionBusy,
  canStart,
  softwareConfigured,
}) {
  const demoTrack = {
    artist: "Martin Roth",
    title: "An Analog Guy in a Digital World",
    bpm: 115,
    key: "A min",
    label: "Stereo Deluxe",
  };

  const displayTrack = currentTrack || (!isTracking ? demoTrack : null);
  const displayHistory = trackHistory;
  const hasRealNowPlaying = Boolean(currentTrack);
  const nowPlayingActive = isTracking || (hasRealNowPlaying && hasFreshTrackEvent);
  const nowPlayingLabel = hasRealNowPlaying
    ? (nowPlayingActive ? "now playing" : "last known")
    : "now playing";

  return (
    <div className="app">
      {/* ── Now Playing ───────────────────────── */}
      <div className="now-playing">
        <div className={`np-eyebrow ${nowPlayingActive ? "live" : ""}`}>
          <div className={`np-eyebrow-dot ${nowPlayingActive ? "live" : ""}`} />
          {nowPlayingLabel}
        </div>
        {displayTrack ? (
          <>
            <div className="np-artist">{displayTrack.artist || "Unknown Artist"}</div>
            <div className="np-title">{displayTrack.title || "Unknown Track"}</div>
            <div className="np-tags">
              {displayTrack.bpm && (
                <span className="np-tag amber">{Math.round(displayTrack.bpm)} BPM</span>
              )}
              {displayTrack.key && (
                <span className="np-tag">{displayTrack.key}</span>
              )}
              {displayTrack.label && (
                <span className="np-tag">{displayTrack.label}</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="np-artist empty">Artist</div>
            <div className="np-title empty">Title</div>
          </>
        )}
      </div>

      {/* ── Controls ─────────────────────────── */}
      <div className={`controls-bar ${isTracking ? "is-live" : ""}`}>
        {isTracking ? (
          <>
            <div className="controls-left">
              <button className="btn-broadcast stop" onClick={onStartStop} disabled={actionBusy}>
                ■ &nbsp;Stop
              </button>
            </div>
            <div className="live-runtime">
              <div className="live-dot" />
              <span className="live-time">{liveElapsedLabel}</span>
            </div>
          </>
        ) : (
          <>
            <button
              className="btn-broadcast start"
              onClick={onStartStop}
              disabled={!canStart}
            >
              ▶ &nbsp;Start broadcasting
            </button>
            <button
              className="controls-export export-icon-only"
              onClick={onExport}
              disabled={!canExportCurrentSet}
              title={!canExportCurrentSet ? "No active set to export" : "Export set"}
              aria-label="Export set"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 17.5v1.8c0 1.5 1.2 2.7 2.7 2.7h8.6c1.5 0 2.7-1.2 2.7-2.7v-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* ── Set list ─────────────────────────── */}
      <div className="log-header">
        <span className="log-label">Set list</span>
        <span className="log-count">{displayHistory.length} tracks</span>
      </div>

      <div className="log-list">
        {displayHistory.length === 0 ? (
          <div className="log-empty">{isTracking ? "Recording... first track pending" : "—"}</div>
        ) : (
          displayHistory.map((track, i) => (
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
