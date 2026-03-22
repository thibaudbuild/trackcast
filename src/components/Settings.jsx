import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DJ_OPTIONS = [
  { value: "rekordbox", label: "Rekordbox" },
  { value: "serato",    label: "Serato DJ Pro" },
  { value: "traktor",   label: "Traktor Pro (3/4)" },
  { value: "virtualdj", label: "VirtualDJ" },
  { value: "mixxx",     label: "Mixxx" },
  { value: "djuced",    label: "DJUCED" },
  { value: "djay",      label: "djay Pro" },
  { value: "denon",     label: "Denon DJ" },
];

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
  const [chatId, setChatId]         = useState(config?.telegram_chat_id || "");
  const [djSoftware, setDjSoftware] = useState(config?.dj_software || "");
  const [testing, setTesting]       = useState(false);
  const [testError, setTestError]   = useState("");
  const [editingSoftware, setEditingSoftware] = useState(!config?.dj_software);
  const [editingToken, setEditingToken] = useState(!config?.telegram_token);
  const [editingChat, setEditingChat] = useState(!config?.telegram_chat_id);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [lockCopyUntilMouseLeave, setLockCopyUntilMouseLeave] = useState(false);
  const [testBtnHover, setTestBtnHover] = useState(false);
  const [lockOkUntilMouseLeave, setLockOkUntilMouseLeave] = useState(false);
  const [traktorStatus, setTraktorStatus] = useState(traktorSetupStatus);
  const [traktorBusyAction, setTraktorBusyAction] = useState("");
  const [traktorInfo, setTraktorInfo] = useState("");
  const [traktorError, setTraktorError] = useState("");

  const initialToken = config?.telegram_token || "";
  const initialChatId = config?.telegram_chat_id || "";
  const initialFp = config?.telegram_verified_fingerprint || "";
  const initialVerified = Boolean(
    config?.telegram_verified &&
    initialFp &&
    initialFp === telegramFingerprint(initialToken, initialChatId)
  );
  const [testOk, setTestOk] = useState(initialVerified);

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
  const [template, setTemplate]     = useState(
    config?.message_template || "🎵 {artist} — {title}"
  );
  const [showBpm, setShowBpm]       = useState(config?.show_bpm ?? true);
  const [showKey, setShowKey]       = useState(config?.show_key ?? false);
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

  const tokenChatChanged = token !== initialToken || chatId !== initialChatId;
  const tokenChatFilled = token.trim() !== "" && chatId.trim() !== "";
  const softwareChanged = djSoftware !== (config?.dj_software || "");
  const connectionUiEditing = editingSoftware || editingToken || editingChat;
  const connectionChanged = softwareChanged || tokenChatChanged || connectionUiEditing;
  const connectionSaveEnabled =
    connectionChanged && (!tokenChatChanged || !tokenChatFilled || testOk);
  const displayChanged =
    setName !== (config?.set_name || "") ||
    template !== (config?.message_template || "🎵 {artist} — {title}") ||
    showBpm !== (config?.show_bpm ?? true) ||
    showKey !== (config?.show_key ?? false) ||
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

  const handleTest = async () => {
    const startedAt = Date.now();
    setTesting(true);
    setTestError("");
    try {
      await invoke("test_telegram", { token, chatId });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1500) {
        await new Promise((resolve) => setTimeout(resolve, 1500 - elapsed));
      }
      setTestOk(true);
      setLockOkUntilMouseLeave(true);
    } catch (_) {
      setTestOk(false);
      setTestError("Test failed. Check token / chat ID.");
    }
    setTesting(false);
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopied(true);
      setLockCopyUntilMouseLeave(true);
    } catch (_) {}
  };

  const handleSave = async () => {
    const fp = telegramFingerprint(token, chatId);
    const verifiedForCurrentValues = tokenChatFilled && (testOk || (!tokenChatChanged && initialVerified));
    await onSave({
      dj_software: djSoftware,
      telegram_token: token,
      telegram_chat_id: chatId,
      telegram_verified: verifiedForCurrentValues,
      telegram_verified_at: verifiedForCurrentValues
        ? (testOk ? new Date().toISOString() : (config?.telegram_verified_at || new Date().toISOString()))
        : null,
      telegram_verified_fingerprint: verifiedForCurrentValues ? fp : null,
      set_name: setName,
      message_template: template,
      show_bpm: showBpm,
      show_key: showKey,
      session_messages_enabled: sessionMessagesEnabled,
      session_start_template: sessionStartTemplate,
      session_end_template: sessionEndTemplate,
    });

    // Relock fields after successful save so UI reflects persisted state.
    setEditingSoftware(false);
    if (token.trim() !== "") setEditingToken(false);
    if (chatId.trim() !== "") setEditingChat(false);
  };

  // Live preview of the message
  const preview = template
    .replace("{artist}", "Blawan")
    .replace("{title}", "Why They Hide Their Bodies")
    .replace("{set_name}", setName || "My Set")
    .replace("{bpm}", "130")
    .replace("{key}", "Am")
    + (showBpm && !template.includes("{bpm}") ? " [130 BPM" + (showKey ? " · Am" : "") + "]" : "")
    + (showKey && !showBpm && !template.includes("{key}") ? " [Am]" : "");
  const sessionStartPreview = (sessionStartTemplate || DEFAULT_SESSION_START)
    .replace("{set_name}", setName || "My Live Set");
  const sessionEndPreview = (sessionEndTemplate || DEFAULT_SESSION_END)
    .replace("{set_name}", setName || "My Live Set");

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
  }, [tab, setName, template, showBpm, showKey, sessionMessagesEnabled, sessionStartTemplate, sessionEndTemplate]);

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
          Live session active — settings are locked until you stop broadcasting.
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
                  setTestOk(false);
                  setTestError("");
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
              Channel / Group ID
            </div>
            <div className="input-row">
              {chatId && !editingChat ? (
                <div className="select-locked" style={{ flex: 1 }}>
                  <span className="select-check">✓</span>
                  <span>{chatId}</span>
                </div>
              ) : (
                <input
                  className="tc-input"
                  type="text"
                  value={chatId}
                  onChange={(e) => {
                    setChatId(e.target.value);
                    setTestOk(false);
                    setTestError("");
                  }}
                  disabled={isTracking}
                  placeholder="@yourchannel or -1001234567890"
                  spellCheck={false}
                />
              )}
              {chatId && !editingChat && (
                <button
                  className="inline-btn"
                  disabled={isTracking}
                  onClick={() => setEditingChat(true)}
                >
                  edit
                </button>
              )}
              <button
                className={`inline-btn test-state-btn ${testing ? "testing" : ""} ${testOk ? "ok" : ""} ${testOk && lockOkUntilMouseLeave ? "ok-locked" : ""} ${!testOk && testError ? "tc-danger-btn test-retry-btn" : ""}`}
                onClick={handleTest}
                disabled={isTracking || !token || !chatId || testing}
                onMouseEnter={() => setTestBtnHover(true)}
                onMouseLeave={() => {
                  setTestBtnHover(false);
                  if (testOk) setLockOkUntilMouseLeave(false);
                }}
              >
                {testing ? (
                  <span className="btn-spinner" aria-hidden="true" />
                ) : testOk ? (
                  (testBtnHover && !lockOkUntilMouseLeave) ? "test" : <span className="test-ok-label">ok</span>
                ) : testError ? (
                  "retry"
                ) : (
                  "test"
                )}
              </button>
            </div>
            {testError && <div className="input-error">{testError}</div>}
            {tokenChatChanged && tokenChatFilled && !testOk && !testError && (
              <div className="input-error">Re-test required before save.</div>
            )}
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
            <div className="settings-inline-options" style={{ display: "flex", gap: 12 }}>
              <label className="tc-check-label">
                <input
                  className="tc-checkbox"
                  type="checkbox"
                  checked={showBpm}
                  onChange={(e) => setShowBpm(e.target.checked)}
                  disabled={isTracking}
                />
                <span className="tc-check-text">Append BPM</span>
              </label>
              <label className="tc-check-label">
                <input
                  className="tc-checkbox"
                  type="checkbox"
                  checked={showKey}
                  onChange={(e) => setShowKey(e.target.checked)}
                  disabled={isTracking}
                />
                <span className="tc-check-text">Append Key</span>
              </label>
            </div>
            <span className="settings-hint selectable-text settings-hint-tight">
              Variables: <code style={{ color: "var(--amber)" }}>{"{artist}"}</code>{" "}
              <code style={{ color: "var(--amber)" }}>{"{title}"}</code>{" "}
              <code style={{ color: "var(--amber)" }}>{"{set_name}"}</code>{" "}
              <code style={{ color: "var(--amber)" }}>{"{bpm}"}</code>{" "}
              <code style={{ color: "var(--amber)" }}>{"{key}"}</code>
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
              className="tc-input"
              type="text"
              value={sessionStartTemplate}
              onChange={(e) => setSessionStartTemplate(e.target.value)}
              maxLength={MAX_SESSION_START_TEMPLATE}
              disabled={isTracking || !sessionMessagesEnabled}
              spellCheck={false}
              placeholder="is starting to play {set_name}"
            />
            <span className="settings-char-count">{sessionStartTemplate.length}/{MAX_SESSION_START_TEMPLATE}</span>
            <input
              className="tc-input"
              type="text"
              value={sessionEndTemplate}
              onChange={(e) => setSessionEndTemplate(e.target.value)}
              maxLength={MAX_SESSION_END_TEMPLATE}
              disabled={isTracking || !sessionMessagesEnabled}
              spellCheck={false}
              placeholder="just finished playing {set_name}"
            />
            <span className="settings-char-count">{sessionEndTemplate.length}/{MAX_SESSION_END_TEMPLATE}</span>
            <span className="settings-hint selectable-text settings-hint-tight">
              Variable: <code style={{ color: "var(--amber)" }}>{"{set_name}"}</code>
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
