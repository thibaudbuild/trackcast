import { open as openExternal } from "@tauri-apps/plugin-shell";

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
  startDisabledReason,
  activeChannelMode = "private",
  onSetChannelMode,
  publicConfigured = false,
  privateConfigured = false,
  publicVerified = false,
  privateVerified = false,
  receiverStatusClass = "",
  receiverDotClass = "",
  receiverStatusLabel = "Connect",
  receiverCanConnect = false,
  onRetryConnection,
  receiverHint = "",
  publicChatId = "",
}) {
  const demoTrack = {
    artist: "Martin Roth",
    title: "An Analog Guy in a Digital World",
    bpm: 115,
    key: "A min",
    label: "Stereo Deluxe",
  };
  const fallbackSetList = [
    {
      time: "23:18",
      artist: demoTrack.artist,
      title: demoTrack.title,
      bpm: demoTrack.bpm,
    },
    {
      time: "23:12",
      artist: "Binary Digit",
      title: "Sneaking Out Of The Club",
      bpm: 124,
    },
    {
      time: "23:07",
      artist: "Phonique",
      title: "Vincent Price",
      bpm: 122,
    },
    {
      time: "23:02",
      artist: "Daft Punk",
      title: "The Game Of Love",
      bpm: 119,
    },
    {
      time: "22:57",
      artist: "Bicep",
      title: "Glue",
      bpm: 124,
    },
    {
      time: "22:52",
      artist: "Peggy Gou",
      title: "Starry Night",
      bpm: 122,
    },
    {
      time: "22:47",
      artist: "Moderat",
      title: "Bad Kingdom",
      bpm: 121,
    },
    {
      time: "22:42",
      artist: "Jamie xx",
      title: "Loud Places",
      bpm: 120,
    },
    {
      time: "22:37",
      artist: "NTO",
      title: "Trauma",
      bpm: 123,
    },
    {
      time: "22:32",
      artist: "The Blaze",
      title: "Territory",
      bpm: 120,
    },
    {
      time: "22:27",
      artist: "Sébastien Léger",
      title: "La Danse Du Scorpion",
      bpm: 123,
    },
    {
      time: "22:22",
      artist: "Maceo Plex",
      title: "When The Lights Are Out",
      bpm: 124,
    },
    {
      time: "22:17",
      artist: "Âme x Trikk",
      title: "Helicopter",
      bpm: 122,
    },
    {
      time: "22:12",
      artist: "DJ Koze",
      title: "Pick Up",
      bpm: 119,
    },
  ];

  const hasReceiverTrack = unboxConnected && Boolean(currentTrack);
  const hasRealNowPlaying = hasReceiverTrack;
  const isFallbackMode = !hasRealNowPlaying;
  const displayTrack = hasRealNowPlaying ? currentTrack : (isTracking ? null : demoTrack);
  const displayHistory = trackHistory.length > 0
    ? trackHistory
    : (!isTracking && isFallbackMode ? fallbackSetList : []);
  const nowPlayingActive = hasRealNowPlaying && hasFreshTrackEvent;
  const nowPlayingLabel = hasRealNowPlaying
    ? (nowPlayingActive ? "now playing" : "last known")
    : "now playing";
  const nowPlayingStateClass = hasRealNowPlaying
    ? (nowPlayingActive ? "is-playing" : "is-last-known")
    : "is-fallback";

  const anyChannelConfigured = publicConfigured || privateConfigured;

  const shareUsername = (() => {
    const trimmed = (publicChatId || "").trim();
    if (trimmed.startsWith("@")) return trimmed.slice(1);
    return "";
  })();
  const shareUrl = shareUsername ? `https://trackcast.xyz/@${shareUsername}` : "";
  const handleShare = () => {
    if (!shareUrl) return;
    openExternal(shareUrl).catch(() => {});
  };
  const shareTitle = shareUrl ? "Share channel" : "Set up a public channel to share";

  return (
    <div className={`main-view ${isFallbackMode ? "is-fallback" : ""}`}>
      {/* ── Sub-bar: channel pill + connect status ── */}
      <div className="channel-pill-bar">
        {anyChannelConfigured ? (
          <div className={`channel-pill ${isTracking ? "locked" : ""}`}>
            <button
              className={`channel-pill-opt ${activeChannelMode === "private" ? "active" : ""} ${!privateConfigured ? "unconfigured" : ""}`}
              disabled={isTracking || !privateConfigured}
              onClick={() => onSetChannelMode?.("private")}
            >
              {privateVerified && <span className="channel-pill-dot green" />}
              Private
            </button>
            <button
              className={`channel-pill-opt ${activeChannelMode === "public" ? "active" : ""} ${!publicConfigured ? "unconfigured" : ""}`}
              disabled={isTracking || !publicConfigured}
              onClick={() => onSetChannelMode?.("public")}
            >
              {publicVerified && <span className="channel-pill-dot green" />}
              Public
            </button>
          </div>
        ) : <div />}
        <button
          className={`sb-item sb-item-action ${receiverStatusClass} ${receiverCanConnect ? "clickable" : ""}`}
          onClick={receiverCanConnect ? onRetryConnection : undefined}
          disabled={!receiverCanConnect}
          title={!receiverCanConnect && receiverHint ? receiverHint : undefined}
        >
          <div className={`sb-dot ${receiverDotClass}`} />
          <span>{receiverStatusLabel}</span>
        </button>
      </div>

      {/* ── Now Playing ───────────────────────── */}
      <div className={`now-playing ${nowPlayingStateClass}`}>
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
        ) : isTracking ? (
          <>
            <div className="np-artist empty">Receiver reconnecting…</div>
            <div className="np-title empty">Waiting for incoming track data</div>
          </>
        ) : (
          <>
            <div className="np-title empty">No track</div>
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
              <button
                className="controls-icon-btn"
                onClick={handleShare}
                disabled={!shareUrl}
                title={shareTitle}
                aria-label="Share channel"
              >
                <ShareQrIcon />
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
              title={!canStart && startDisabledReason ? startDisabledReason : undefined}
            >
              ▶ &nbsp;Start broadcasting
            </button>
            <div className="controls-icons">
              <button
                className="controls-icon-btn"
                onClick={handleShare}
                disabled={!shareUrl}
                title={shareTitle}
                aria-label="Share channel"
              >
                <ShareQrIcon />
              </button>
              <button
                className="controls-icon-btn"
                onClick={onExport}
                disabled={!canExportCurrentSet}
                title={!canExportCurrentSet ? "No active set to export" : "Export set"}
                aria-label="Export set"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 17.5v1.8c0 1.5 1.2 2.7 2.7 2.7h8.6c1.5 0 2.7-1.2 2.7-2.7v-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Set list ─────────────────────────── */}
      <div className="log-header">
        <span className="log-label">Set list</span>
        <span className="log-count">{displayHistory.length} tracks</span>
      </div>

      <div className="main-setlist-region">
        <div className="log-list main-setlist-scroll">
          {displayHistory.length === 0 ? (
            <div className="log-empty">
              {isTracking
                ? (hasRealNowPlaying ? "Waiting for next track change..." : "Waiting for first track...")
                : "—"}
            </div>
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
    </div>
  );
}

function ShareQrIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6" y="6" width="1.5" height="1.5" fill="currentColor" />
      <rect x="16.5" y="6" width="1.5" height="1.5" fill="currentColor" />
      <rect x="6" y="16.5" width="1.5" height="1.5" fill="currentColor" />
      <rect x="14" y="14" width="2.5" height="2.5" fill="currentColor" />
      <rect x="18" y="14" width="2.5" height="2.5" fill="currentColor" />
      <rect x="14" y="18" width="2.5" height="2.5" fill="currentColor" />
      <rect x="18" y="18" width="2.5" height="2.5" fill="currentColor" />
    </svg>
  );
}
