import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DJ_OPTIONS = [
  { value: "rekordbox", label: "Rekordbox", badge: "verified" },
  { value: "serato",    label: "Serato DJ Pro", badge: "supported" },
  { value: "traktor",   label: "Traktor Pro (3/4)", badge: "supported" },
  { value: "virtualdj", label: "VirtualDJ", badge: "beta" },
  { value: "mixxx",     label: "Mixxx", badge: "beta" },
  { value: "djuced",    label: "DJUCED", badge: "beta" },
  { value: "djay",      label: "djay Pro", badge: "beta" },
  { value: "denon",     label: "Denon DJ", badge: "beta" },
];

const BADGE_LABELS = {
  verified: "Verified",
  supported: "Supported",
  beta: "Beta",
};

const TABS = ["connection", "display"];

const TEMPLATE_PRESETS = [
  { label: "Default",       value: "🎵 {artist} — {title}" },
  { label: "With set name", value: "🎵 {set_name} · {artist} — {title}" },
  { label: "Minimal",       value: "{artist} — {title}" },
  { label: "Custom",        value: null },
];
const DEFAULT_SESSION_START = "is starting to play {set_name}";
const DEFAULT_SESSION_END = "just finished playing {set_name}";
const MAX_SET_NAME = 36;
const MAX_TEMPLATE = 52;
const MAX_SESSION_START_TEMPLATE = 52;
const MAX_SESSION_END_TEMPLATE = 72;

const telegramFingerprint = (token, chatId) =>
  `${(token || "").trim()}::${(chatId || "").trim()}`;

const maskToken = (token) => {
  if (!token) return "";
  if (token.length <= 10) return `${token.slice(0, 4)}···`;
  return `${token.slice(0, 6)}···${token.slice(-4)}`;
};

export default function Settings({
  config,
  onSave,
  isTracking = false,
  tab: controlledTab,
  onTabChange,
  showTabBar = true,
  traktorSetupStatus = null,
}) {
  const [localTab, setLocalTab] = useState("connection");
  const tab = controlledTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;

  // Connection fields
  const [token, setToken]           = useState(config?.telegram_token || "");
  const [djSoftware, setDjSoftware] = useState(config?.dj_software || "");
  const [editingSoftware, setEditingSoftware] = useState(!config?.dj_software);
  const [editingToken, setEditingToken] = useState(!config?.telegram_token);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [lockCopyUntilMouseLeave, setLockCopyUntilMouseLeave] = useState(false);
  const [traktorStatus, setTraktorStatus] = useState(traktorSetupStatus);
  const [traktorBusyAction, setTraktorBusyAction] = useState("");
  const [traktorInfo, setTraktorInfo] = useState("");
  const [traktorError, setTraktorError] = useState("");

  // Public channel slot
  const [publicChatId, setPublicChatId] = useState(config?.public_chat_id || "");
  const [publicChatTitle, setPublicChatTitle] = useState(config?.public_chat_title || "");
  const [editingPublicChat, setEditingPublicChat] = useState(!config?.public_chat_id);
  const [testingPublic, setTestingPublic] = useState(false);
  const [testPublicError, setTestPublicError] = useState("");
  const [testPublicBtnHover, setTestPublicBtnHover] = useState(false);
  const [lockPublicOkUntilMouseLeave, setLockPublicOkUntilMouseLeave] = useState(false);

  const initialPublicChatId = config?.public_chat_id || "";
  const initialPublicFp = config?.public_verified_fingerprint || "";
  const initialPublicVerified = Boolean(
    config?.public_verified &&
    initialPublicFp &&
    initialPublicFp === telegramFingerprint(config?.telegram_token || "", initialPublicChatId)
  );
  const [testPublicOk, setTestPublicOk] = useState(initialPublicVerified);

  // Private channel slot
  const [privateChatId, setPrivateChatId] = useState(config?.private_chat_id || "");
  const [privateChatTitle, setPrivateChatTitle] = useState(config?.private_chat_title || "");
  const [editingPrivateChat, setEditingPrivateChat] = useState(!config?.private_chat_id);
  const [testingPrivate, setTestingPrivate] = useState(false);
  const [testPrivateError, setTestPrivateError] = useState("");
  const [testPrivateBtnHover, setTestPrivateBtnHover] = useState(false);
  const [lockPrivateOkUntilMouseLeave, setLockPrivateOkUntilMouseLeave] = useState(false);

  const initialPrivateChatId = config?.private_chat_id || "";
  const initialPrivateFp = config?.private_verified_fingerprint || "";
  const initialPrivateVerified = Boolean(
    config?.private_verified &&
    initialPrivateFp &&
    initialPrivateFp === telegramFingerprint(config?.telegram_token || "", initialPrivateChatId)
  );
  const [testPrivateOk, setTestPrivateOk] = useState(initialPrivateVerified);

  // Channel detection
  const [detecting, setDetecting] = useState(false);
  const [detectedChannels, setDetectedChannels] = useState([]);
  const [detectSlot, setDetectSlot] = useState(null); // "public" | "private"
  const [detectError, setDetectError] = useState("");

  // Which slot is being viewed/edited in the single Channel row

  const refreshTraktorStatus = async () => {
    if (djSoftware !== "traktor") return;
    try {
      const status = await invoke("get_traktor_setup_status");
      setTraktorStatus(status);
    } catch (_) {
      setTraktorStatus({
        plugin_files_present: false,
        runtime_api_reachable: false,
        overall_ready: false,
        expected_version: "unbox-d2-v1",
        installed_version: null,
        version_match: false,
      });
    }
  };

  useEffect(() => {
    if (djSoftware !== "traktor") {
      setTraktorStatus(null);
      setTraktorError("");
      setTraktorInfo("");
      setTraktorBusyAction("");
      return;
    }
    refreshTraktorStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [djSoftware]);

  useEffect(() => {
    if (djSoftware === "traktor" && traktorSetupStatus) {
      setTraktorStatus(traktorSetupStatus);
    }
  }, [djSoftware, traktorSetupStatus]);

  // Display fields
  const [setName, setSetName]       = useState(config?.set_name || "");
  const [template, setTemplate]     = useState(() => {
    let t = config?.message_template || "🎵 {artist} — {title}";
    // Legacy migration: old show_bpm / show_key flags are now expressed as inline
    // {bpm} / {key} tokens in the template itself. Append them once if the saved
    // config still relies on the flags and the template doesn't already use them.
    const wantsBpm = config?.show_bpm && !t.includes("{bpm}");
    const wantsKey = config?.show_key && !t.includes("{key}");
    if (wantsBpm && wantsKey) t += " [{bpm} BPM · {key}]";
    else if (wantsBpm) t += " [{bpm} BPM]";
    else if (wantsKey) t += " [{key}]";
    return t.slice(0, MAX_TEMPLATE);
  });
  const [sessionMessagesEnabled, setSessionMessagesEnabled] = useState(
    config?.session_messages_enabled ?? false
  );
  const [sessionStartTemplate, setSessionStartTemplate] = useState(
    config?.session_start_template || DEFAULT_SESSION_START
  );
  const [sessionEndTemplate, setSessionEndTemplate] = useState(
    config?.session_end_template || DEFAULT_SESSION_END
  );
  const displayScrollRef = useRef(null);
  const [displayHasOverflow, setDisplayHasOverflow] = useState(false);
  const templateInputRef = useRef(null);
  const sessionStartInputRef = useRef(null);
  const sessionEndInputRef = useRef(null);
  const lastFocusedSessionRef = useRef("start");

  const insertAtInput = (inputRef, setValue, maxLen, token) => {
    const el = inputRef.current;
    let nextCursor = 0;
    setValue((prev) => {
      const selStart = el?.selectionStart ?? prev.length;
      const selEnd = el?.selectionEnd ?? prev.length;
      const next = (prev.slice(0, selStart) + token + prev.slice(selEnd)).slice(0, maxLen);
      nextCursor = Math.min(selStart + token.length, next.length);
      return next;
    });
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertIntoTemplate = (token) =>
    insertAtInput(templateInputRef, setTemplate, MAX_TEMPLATE, token);

  const insertIntoSessionTemplate = (token) => {
    if (lastFocusedSessionRef.current === "end") {
      insertAtInput(sessionEndInputRef, setSessionEndTemplate, MAX_SESSION_END_TEMPLATE, token);
    } else {
      insertAtInput(sessionStartInputRef, setSessionStartTemplate, MAX_SESSION_START_TEMPLATE, token);
    }
  };

  const initialToken = config?.telegram_token || "";
  const tokenChanged = token !== initialToken;
  const publicChatChanged = publicChatId !== initialPublicChatId;
  const privateChatChanged = privateChatId !== initialPrivateChatId;
  const publicFilled = token.trim() !== "" && publicChatId.trim() !== "";
  const privateFilled = token.trim() !== "" && privateChatId.trim() !== "";
  const softwareChanged = djSoftware !== (config?.dj_software || "");
  const connectionUiEditing = editingSoftware || editingToken || editingPublicChat || editingPrivateChat;
  const connectionChanged = softwareChanged || tokenChanged || publicChatChanged || privateChatChanged || connectionUiEditing;
  // Per-slot: if the slot changed AND has values, require test before save
  const publicNeedsTest = (tokenChanged || publicChatChanged) && publicFilled && !testPublicOk;
  const privateNeedsTest = (tokenChanged || privateChatChanged) && privateFilled && !testPrivateOk;
  const connectionSaveEnabled =
    connectionChanged && !publicNeedsTest && !privateNeedsTest;
  const displayChanged =
    setName !== (config?.set_name || "") ||
    template !== (config?.message_template || "🎵 {artist} — {title}") ||
    sessionMessagesEnabled !== (config?.session_messages_enabled ?? false) ||
    sessionStartTemplate !== (config?.session_start_template || DEFAULT_SESSION_START) ||
    sessionEndTemplate !== (config?.session_end_template || DEFAULT_SESSION_END);
  const sessionMessagesInvalid = sessionMessagesEnabled && setName.trim() === "";
  const canSave = tab === "connection"
    ? connectionSaveEnabled
    : (displayChanged && !sessionMessagesInvalid);

  const traktorNeedsSetup = djSoftware === "traktor" && !traktorStatus?.overall_ready;
  const traktorStatusLabel =
    !traktorStatus?.plugin_files_present
      ? "Not installed"
      : (traktorStatus?.overall_ready ? "Ready" : "Installed, waiting runtime verify");
  const traktorInstallLabel = traktorStatus?.plugin_files_present ? "Reinstall" : "Install";

  const handleInstallTraktorHelper = async () => {
    setTraktorBusyAction("install");
    setTraktorError("");
    setTraktorInfo("");
    try {
      const msg = await invoke("install_traktor_helper");
      setTraktorInfo(msg);
      await refreshTraktorStatus();
    } catch (e) {
      setTraktorError(String(e));
    }
    setTraktorBusyAction("");
  };

  const handleOpenTraktorFolder = async () => {
    setTraktorBusyAction("open");
    setTraktorError("");
    setTraktorInfo("");
    try {
      const msg = await invoke("open_traktor_csi_folder");
      setTraktorInfo(msg);
    } catch (e) {
      setTraktorError(String(e));
    }
    setTraktorBusyAction("");
  };

  const handleVerifyTraktorRuntime = async () => {
    setTraktorBusyAction("verify");
    setTraktorError("");
    setTraktorInfo("");
    try {
      const status = await invoke("verify_traktor_runtime");
      setTraktorStatus(status);
      setTraktorInfo("Traktor setup verified.");
    } catch (e) {
      setTraktorError(String(e));
      await refreshTraktorStatus();
    }
    setTraktorBusyAction("");
  };

  const handleTestSlot = async (slot) => {
    const chatId = slot === "public" ? publicChatId : privateChatId;
    const setTestingFn = slot === "public" ? setTestingPublic : setTestingPrivate;
    const setErrorFn = slot === "public" ? setTestPublicError : setTestPrivateError;
    const setOkFn = slot === "public" ? setTestPublicOk : setTestPrivateOk;
    const setLockFn = slot === "public" ? setLockPublicOkUntilMouseLeave : setLockPrivateOkUntilMouseLeave;
    const startedAt = Date.now();
    setTestingFn(true);
    setErrorFn("");
    try {
      await invoke("test_telegram", { token, chatId });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
      }
      setOkFn(true);
      setLockFn(true);
    } catch (_) {
      setOkFn(false);
      setErrorFn("Test failed. Check token / chat ID.");
    }
    setTestingFn(false);
  };

  const handleDetectChannels = async (slot) => {
    setDetecting(true);
    setDetectSlot(slot);
    setDetectError("");
    setDetectedChannels([]);
    try {
      const channels = await invoke("detect_channels", { token });
      setDetectedChannels(channels || []);
      if (!channels || channels.length === 0) {
        setDetectError("No channels found. Add the bot to a channel/group first.");
      }
    } catch (e) {
      setDetectError(String(e));
    }
    setDetecting(false);
  };

  const handleSelectDetectedChannel = (channel) => {
    if (detectSlot === "public") {
      setPublicChatId(channel.chat_id);
      setPublicChatTitle(channel.title);
      setTestPublicOk(false);
      setTestPublicError("");
      setEditingPublicChat(false);
    } else {
      setPrivateChatId(channel.chat_id);
      setPrivateChatTitle(channel.title);
      setTestPrivateOk(false);
      setTestPrivateError("");
      setEditingPrivateChat(false);
    }
    setDetectedChannels([]);
    setDetectSlot(null);
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setLockCopyUntilMouseLeave(true);
    } catch (_) {}
  };

  const handleSave = async () => {
    const pubFp = telegramFingerprint(token, publicChatId);
    const privFp = telegramFingerprint(token, privateChatId);
    const pubVerified = publicFilled && (testPublicOk || (!publicChatChanged && !tokenChanged && initialPublicVerified));
    const privVerified = privateFilled && (testPrivateOk || (!privateChatChanged && !tokenChanged && initialPrivateVerified));
    await onSave({
      dj_software: djSoftware,
      telegram_token: token,
      telegram_chat_id: "",
      telegram_verified: false,
      telegram_verified_at: null,
      telegram_verified_fingerprint: null,
      public_chat_id: publicChatId,
      public_chat_title: publicChatTitle || null,
      public_verified: pubVerified,
      public_verified_at: pubVerified
        ? (testPublicOk ? new Date().toISOString() : (config?.public_verified_at || new Date().toISOString()))
        : null,
      public_verified_fingerprint: pubVerified ? pubFp : null,
      private_chat_id: privateChatId,
      private_chat_title: privateChatTitle || null,
      private_verified: privVerified,
      private_verified_at: privVerified
        ? (testPrivateOk ? new Date().toISOString() : (config?.private_verified_at || new Date().toISOString()))
        : null,
      private_verified_fingerprint: privVerified ? privFp : null,
      set_name: setName,
      message_template: template,
      session_messages_enabled: sessionMessagesEnabled,
      session_start_template: sessionStartTemplate,
      session_end_template: sessionEndTemplate,
    });

    // Relock fields after successful save so UI reflects persisted state.
    setEditingSoftware(false);
    if (token.trim() !== "") setEditingToken(false);
    if (publicChatId.trim() !== "") setEditingPublicChat(false);
    if (privateChatId.trim() !== "") setEditingPrivateChat(false);
  };

  // Live preview of the message
  const preview = template
    .replaceAll("{artist}", "Moby")
    .replaceAll("{title}", "Porcelain")
    .replaceAll("{set_name}", setName || "My Set")
    .replaceAll("{bpm}", "96")
    .replaceAll("{key}", "F");
  const sessionStartPreview = (sessionStartTemplate || DEFAULT_SESSION_START)
    .replaceAll("{set_name}", setName || "My Live Set");
  const sessionEndPreview = (sessionEndTemplate || DEFAULT_SESSION_END)
    .replaceAll("{set_name}", setName || "My Live Set");

  useEffect(() => {
    if (tab !== "display") {
      setDisplayHasOverflow(false);
      return;
    }

    const scrollEl = displayScrollRef.current;
    if (!scrollEl) return;

    const updateScrollState = () => {
      setDisplayHasOverflow(scrollEl.scrollHeight - scrollEl.clientHeight > 2);
    };

    updateScrollState();
    scrollEl.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scrollEl.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [tab, setName, template, sessionMessagesEnabled, sessionStartTemplate, sessionEndTemplate]);

  return (
    <div className={`settings-panel ${tab === "display" ? "tab-display" : ""} ${isTracking ? "is-locked" : ""}`}>
      {showTabBar && (
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
        }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: tab === t ? "1px solid var(--amber)" : "1px solid transparent",
                color: tab === t ? "var(--amber)" : "var(--text-dim)",
                fontFamily: "var(--mono)",
                fontSize: "10px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                cursor: "pointer",
                marginBottom: "-1px",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {isTracking && (
        <div className="settings-locked-banner">
          <span className="settings-locked-dot" aria-hidden="true" />
          Broadcast in progress · Settings are read-only
        </div>
      )}

      {/* ── Connection tab ──────────────────── */}
      {tab === "connection" && (
        <>
          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              DJ Software
            </div>
            {djSoftware && !editingSoftware ? (
              <div className="input-row">
                <div className="select-locked" style={{ flex: 1 }}>
                  <span className="select-check">✓</span>
                  <span>{DJ_OPTIONS.find((o) => o.value === djSoftware)?.label || djSoftware}</span>
                  {DJ_OPTIONS.find((o) => o.value === djSoftware)?.badge && (
                    <span className={`dj-badge ${DJ_OPTIONS.find((o) => o.value === djSoftware).badge}`} style={{ marginLeft: 8 }}>
                      {BADGE_LABELS[DJ_OPTIONS.find((o) => o.value === djSoftware).badge]}
                    </span>
                  )}
                </div>
                <button
                  className="inline-btn"
                  disabled={isTracking}
                  onClick={() => setEditingSoftware(true)}
                >
                  edit
                </button>
              </div>
            ) : (
              <select
                className="tc-select"
                value={djSoftware}
                onChange={(e) => setDjSoftware(e.target.value)}
                disabled={isTracking}
              >
                <option value="">Select...</option>
                {DJ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
          </div>

          {djSoftware === "traktor" && (
            <div className="row active">
              <div className="row-label">
                <span className="row-num">—</span>
                Traktor Setup
              </div>
              <div className="traktor-setup-status">
                <span className={`traktor-setup-dot ${traktorStatus?.overall_ready ? "ok" : (traktorStatus?.plugin_files_present ? "warn" : "")}`} />
                <span>{traktorStatusLabel}</span>
              </div>
              <div className="input-row">
                <button
                  className="inline-btn"
                  disabled={isTracking || traktorBusyAction !== ""}
                  onClick={handleInstallTraktorHelper}
                >
                  {traktorBusyAction === "install" ? "···" : traktorInstallLabel}
                </button>
                <button
                  className="inline-btn"
                  disabled={isTracking || traktorBusyAction !== ""}
                  onClick={handleOpenTraktorFolder}
                >
                  {traktorBusyAction === "open" ? "···" : "Open CSI folder"}
                </button>
                <button
                  className={`inline-btn ${traktorStatus?.overall_ready ? "ok" : ""}`}
                  disabled={isTracking || traktorBusyAction !== ""}
                  onClick={handleVerifyTraktorRuntime}
                >
                  {traktorBusyAction === "verify" ? "···" : "Verify"}
                </button>
              </div>
              {traktorNeedsSetup && (
                <div className="input-error">Traktor setup incomplete — install helper + verify.</div>
              )}
              {traktorStatus?.plugin_files_present && traktorStatus?.version_match === false && (
                <div className="settings-hint">Helper version mismatch. Reinstall recommended.</div>
              )}
              {traktorError && <div className="input-error">{traktorError}</div>}
              {traktorInfo && <div className="settings-hint">{traktorInfo}</div>}
            </div>
          )}

          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              Telegram Bot Token
            </div>
            {token && !editingToken ? (
              <div className="input-row">
                <div className="select-locked selectable-text" style={{ flex: 1 }} title={token}>
                  <span className="select-check">✓</span>
                  <span>{maskToken(token)}</span>
                </div>
                <button
                  className="inline-btn"
                  disabled={isTracking}
                  onClick={() => setEditingToken(true)}
                >
                  edit
                </button>
                <button
                  className={`inline-btn token-copy-btn ${tokenCopied ? "ok" : ""}`}
                  disabled={isTracking}
                  onClick={handleCopyToken}
                  onMouseLeave={() => {
                    if (tokenCopied && lockCopyUntilMouseLeave) {
                      setTokenCopied(false);
                      setLockCopyUntilMouseLeave(false);
                    }
                  }}
                >
                  {tokenCopied ? <span className="copy-ok" aria-hidden="true">✓</span> : "copy"}
                </button>
              </div>
            ) : (
              <input
                className="tc-input"
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTestPublicOk(false);
                  setTestPublicError("");
                  setTestPrivateOk(false);
                  setTestPrivateError("");
                }}
                disabled={isTracking}
                placeholder="123456:ABC-DEF1234..."
                spellCheck={false}
              />
            )}
          </div>

          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              Channel
            </div>
            <div className="channel-section-tip">
              Private goes to your trusted listeners — and it's the safe place to test. Public is what the crowd sees.
            </div>

            <div className="channel-slot">
              <div className="input-row">
                <span className="channel-slot-label">
                  Private<span className="channel-slot-required" aria-label="required">*</span>
                </span>
                {privateChatId && !editingPrivateChat ? (
                  <div className="select-locked" style={{ flex: 1 }}>
                    <span className="select-check">✓</span>
                    <span>{privateChatTitle || privateChatId}</span>
                  </div>
                ) : (
                  <input
                    className="tc-input"
                    type="text"
                    value={privateChatId}
                    onChange={(e) => {
                      setPrivateChatId(e.target.value);
                      setPrivateChatTitle("");
                      setTestPrivateOk(false);
                      setTestPrivateError("");
                    }}
                    disabled={isTracking}
                    placeholder="@yourchannel or -1001234567890"
                    spellCheck={false}
                  />
                )}
                {privateChatId && !editingPrivateChat && (
                  <button
                    className="inline-btn"
                    disabled={isTracking}
                    onClick={() => setEditingPrivateChat(true)}
                  >
                    edit
                  </button>
                )}
                {!privateChatId && (
                  <button
                    className="inline-btn"
                    disabled={isTracking || !token || detecting}
                    onClick={() => handleDetectChannels("private")}
                  >
                    {detecting && detectSlot === "private" ? <span className="btn-spinner" aria-hidden="true" /> : "detect"}
                  </button>
                )}
                {(!privateChatId || editingPrivateChat) && (
                  <button
                    className={`inline-btn test-state-btn ${testingPrivate ? "testing" : ""} ${testPrivateOk ? "ok" : ""} ${testPrivateOk && lockPrivateOkUntilMouseLeave ? "ok-locked" : ""} ${!testPrivateOk && testPrivateError ? "tc-danger-btn test-retry-btn" : ""}`}
                    onClick={() => handleTestSlot("private")}
                    disabled={isTracking || !token || !privateChatId || testingPrivate}
                    onMouseEnter={() => setTestPrivateBtnHover(true)}
                    onMouseLeave={() => {
                      setTestPrivateBtnHover(false);
                      if (testPrivateOk) setLockPrivateOkUntilMouseLeave(false);
                    }}
                  >
                    {testingPrivate ? (
                      <span className="btn-spinner" aria-hidden="true" />
                    ) : testPrivateOk ? (
                      (testPrivateBtnHover && !lockPrivateOkUntilMouseLeave) ? "test" : <span className="test-ok-label">ok</span>
                    ) : testPrivateError ? (
                      "retry"
                    ) : (
                      "test"
                    )}
                  </button>
                )}
              </div>
              {detectSlot === "private" && detectedChannels.length > 0 && (
                <div className="channel-detect-list">
                  {detectedChannels.map((ch) => (
                    <button key={ch.chat_id} className="channel-detect-item" onClick={() => handleSelectDetectedChannel(ch)}>
                      <span className="channel-detect-title">{ch.title}</span>
                      <span className="channel-detect-id">{ch.chat_id}</span>
                    </button>
                  ))}
                </div>
              )}
              {detectSlot === "private" && detectError && <div className="input-error">{detectError}</div>}
              {testPrivateError && <div className="input-error">{testPrivateError}</div>}
              {privateNeedsTest && !testPrivateError && (
                <div className="input-error">Re-test required before save.</div>
              )}
            </div>

            <div className="channel-slot">
              <div className="input-row">
                <span className="channel-slot-label">Public</span>
                {publicChatId && !editingPublicChat ? (
                  <div className="select-locked" style={{ flex: 1 }}>
                    <span className="select-check">✓</span>
                    <span>{publicChatTitle || publicChatId}</span>
                  </div>
                ) : (
                  <input
                    className="tc-input"
                    type="text"
                    value={publicChatId}
                    onChange={(e) => {
                      setPublicChatId(e.target.value);
                      setPublicChatTitle("");
                      setTestPublicOk(false);
                      setTestPublicError("");
                    }}
                    disabled={isTracking}
                    placeholder="@yourchannel or -1001234567890"
                    spellCheck={false}
                  />
                )}
                {publicChatId && !editingPublicChat && (
                  <button
                    className="inline-btn"
                    disabled={isTracking}
                    onClick={() => setEditingPublicChat(true)}
                  >
                    edit
                  </button>
                )}
                {!publicChatId && (
                  <button
                    className="inline-btn"
                    disabled={isTracking || !token || detecting}
                    onClick={() => handleDetectChannels("public")}
                  >
                    {detecting && detectSlot === "public" ? <span className="btn-spinner" aria-hidden="true" /> : "detect"}
                  </button>
                )}
                {(!publicChatId || editingPublicChat) && (
                  <button
                    className={`inline-btn test-state-btn ${testingPublic ? "testing" : ""} ${testPublicOk ? "ok" : ""} ${testPublicOk && lockPublicOkUntilMouseLeave ? "ok-locked" : ""} ${!testPublicOk && testPublicError ? "tc-danger-btn test-retry-btn" : ""}`}
                    onClick={() => handleTestSlot("public")}
                    disabled={isTracking || !token || !publicChatId || testingPublic}
                    onMouseEnter={() => setTestPublicBtnHover(true)}
                    onMouseLeave={() => {
                      setTestPublicBtnHover(false);
                      if (testPublicOk) setLockPublicOkUntilMouseLeave(false);
                    }}
                  >
                    {testingPublic ? (
                      <span className="btn-spinner" aria-hidden="true" />
                    ) : testPublicOk ? (
                      (testPublicBtnHover && !lockPublicOkUntilMouseLeave) ? "test" : <span className="test-ok-label">ok</span>
                    ) : testPublicError ? (
                      "retry"
                    ) : (
                      "test"
                    )}
                  </button>
                )}
              </div>
              {detectSlot === "public" && detectedChannels.length > 0 && (
                <div className="channel-detect-list">
                  {detectedChannels.map((ch) => (
                    <button key={ch.chat_id} className="channel-detect-item" onClick={() => handleSelectDetectedChannel(ch)}>
                      <span className="channel-detect-title">{ch.title}</span>
                      <span className="channel-detect-id">{ch.chat_id}</span>
                    </button>
                  ))}
                </div>
              )}
              {detectSlot === "public" && detectError && <div className="input-error">{detectError}</div>}
              {testPublicError && <div className="input-error">{testPublicError}</div>}
              {publicNeedsTest && !testPublicError && (
                <div className="input-error">Re-test required before save.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Display tab ──────────────────────── */}
      {tab === "display" && (
        <div className="settings-display-scroll" ref={displayScrollRef}>
          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              Set Name
            </div>
            <input
              className="tc-input"
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              maxLength={MAX_SET_NAME}
              disabled={isTracking}
              placeholder="Live @ Fabric, Club night, Open air..."
              spellCheck={false}
            />
            <span className="settings-char-count">{setName.length}/{MAX_SET_NAME}</span>
            <div className="settings-hint-row settings-hint-row-tight">
              <span className="settings-hint selectable-text">
                Shown in track and set messages
              </span>
            </div>
          </div>

          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              Track Messages
            </div>
            <div className="settings-presets">
              {TEMPLATE_PRESETS.filter(p => p.value).map((p) => (
                <button
                  key={p.value}
                  className={`inline-btn template-preset-btn ${template === p.value ? "ok" : ""}`}
                  onClick={() => setTemplate(p.value)}
                  disabled={isTracking}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isTracking ? (
              <div className="settings-preview-like">{template}</div>
            ) : (
              <input
                ref={templateInputRef}
                className="tc-input"
                type="text"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                maxLength={MAX_TEMPLATE}
                disabled={isTracking}
                spellCheck={false}
              />
            )}
            <span className="settings-char-count">{template.length}/{MAX_TEMPLATE}</span>
            <span className="settings-hint settings-hint-tight">
              Variables:{" "}
              {["{artist}", "{title}", "{set_name}", "{bpm}", "{key}"].map((tok) => (
                <button
                  key={tok}
                  type="button"
                  className="settings-var-chip"
                  onClick={() => insertIntoTemplate(tok)}
                  disabled={isTracking}
                >
                  {tok}
                </button>
              ))}
            </span>
            <div className="settings-preview">
              {preview}
            </div>
          </div>

          <div className="row active">
            <div className="row-label">
              <span className="row-num">—</span>
              Set Auto Messages
            </div>
            <label className="tc-check-label settings-hint-tight">
              <input
                className="tc-checkbox"
                type="checkbox"
                checked={sessionMessagesEnabled}
                onChange={(e) => setSessionMessagesEnabled(e.target.checked)}
                disabled={isTracking}
              />
              <span className="tc-check-text">Send automatic start/end set messages</span>
            </label>
            {sessionMessagesInvalid && (
              <div className="input-error">Set name is required when auto messages are enabled.</div>
            )}
            <input
              ref={sessionStartInputRef}
              className="tc-input"
              type="text"
              value={sessionStartTemplate}
              onChange={(e) => setSessionStartTemplate(e.target.value)}
              onFocus={() => { lastFocusedSessionRef.current = "start"; }}
              maxLength={MAX_SESSION_START_TEMPLATE}
              disabled={isTracking || !sessionMessagesEnabled}
              spellCheck={false}
              placeholder="is starting to play {set_name}"
            />
            <span className="settings-char-count">{sessionStartTemplate.length}/{MAX_SESSION_START_TEMPLATE}</span>
            <input
              ref={sessionEndInputRef}
              className="tc-input"
              type="text"
              value={sessionEndTemplate}
              onChange={(e) => setSessionEndTemplate(e.target.value)}
              onFocus={() => { lastFocusedSessionRef.current = "end"; }}
              maxLength={MAX_SESSION_END_TEMPLATE}
              disabled={isTracking || !sessionMessagesEnabled}
              spellCheck={false}
              placeholder="just finished playing {set_name}"
            />
            <span className="settings-char-count">{sessionEndTemplate.length}/{MAX_SESSION_END_TEMPLATE}</span>
            <span className="settings-hint settings-hint-tight">
              Variable:{" "}
              <button
                type="button"
                className="settings-var-chip"
                onClick={() => insertIntoSessionTemplate("{set_name}")}
                disabled={isTracking || !sessionMessagesEnabled}
              >
                {"{set_name}"}
              </button>
            </span>
            <div className={`settings-preview ${sessionMessagesEnabled ? "" : "muted"}`}>
              <div>{sessionStartPreview}</div>
              <div className="settings-preview-line">{sessionEndPreview}</div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`row settings-save-row ${tab === "display" && displayHasOverflow ? "has-scroll-shadow" : ""}`}
        style={{ borderBottom: "none" }}
      >
        <button
          className="btn-broadcast start settings-save-btn"
          onClick={handleSave}
          disabled={isTracking || !canSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}
