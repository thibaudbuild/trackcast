import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DJ_OPTIONS = [
  { value: "rekordbox", label: "Rekordbox", badge: "verified" },
  { value: "serato", label: "Serato DJ Pro", badge: "supported" },
  { value: "traktor", label: "Traktor Pro (3/4)", badge: "supported" },
  { value: "virtualdj", label: "VirtualDJ", badge: "beta" },
  { value: "mixxx", label: "Mixxx", badge: "beta" },
  { value: "djuced", label: "DJUCED", badge: "beta" },
  { value: "djay", label: "djay Pro", badge: "beta" },
  { value: "denon", label: "Denon DJ", badge: "beta" },
];

const BADGE_LABELS = {
  verified: "Verified",
  supported: "Supported",
  beta: "Beta",
};

export default function OnboardingWizard({ config, onComplete }) {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [botName, setBotName] = useState("");
  const [verifyState, setVerifyState] = useState("idle"); // idle | busy | ok | error
  const [verifyError, setVerifyError] = useState("");

  const [channels, setChannels] = useState([]);
  const [detectState, setDetectState] = useState("idle"); // idle | busy | error
  const [detectError, setDetectError] = useState("");
  const [chatId, setChatId] = useState("");
  const [chatTitle, setChatTitle] = useState("");
  const [testState, setTestState] = useState("idle"); // idle | busy | ok | error
  const [testError, setTestError] = useState("");
  const [manualEntry, setManualEntry] = useState(false);

  const [djSoftware, setDjSoftware] = useState("");

  // Step 1: Verify token
  const handleVerifyToken = async () => {
    if (!token.trim()) return;
    const startedAt = Date.now();
    setVerifyState("busy");
    setVerifyError("");
    try {
      const result = await invoke("verify_token", { token: token.trim() });
      // Minimum 1.2s spinner so it doesn't feel instant/glitchy
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) {
        await new Promise((r) => setTimeout(r, 1200 - elapsed));
      }
      setBotName(result?.bot_name || result?.username || "Your bot");
      setVerifyState("ok");
      // Save token immediately
      await invoke("save_config", {
        config: { ...config, telegram_token: token.trim() },
      });
      // Auto-advance after 1s
      setTimeout(() => setStep(1), 1000);
    } catch (e) {
      setVerifyState("error");
      setVerifyError(String(e));
    }
  };

  // Step 2: Detect channels
  const handleDetect = async () => {
    setDetectState("busy");
    setDetectError("");
    setChannels([]);
    try {
      const found = await invoke("detect_channels", { token: token.trim() });
      setChannels(found || []);
      if (!found || found.length === 0) {
        setDetectError("No channels found. Add the bot to a channel or group first.");
      }
      setDetectState("idle");
    } catch (e) {
      setDetectState("error");
      setDetectError(String(e));
    }
  };

  const handleSelectChannel = (ch) => {
    setChatId(ch.chat_id);
    setChatTitle(ch.title);
    setChannels([]);
    setManualEntry(false);
    setTestState("idle");
    setTestError("");
  };

  const handleTestChannel = async () => {
    if (!chatId.trim()) return;
    const startedAt = Date.now();
    setTestState("busy");
    setTestError("");
    try {
      await invoke("test_telegram", { token: token.trim(), chatId: chatId.trim() });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1500) {
        await new Promise((r) => setTimeout(r, 1500 - elapsed));
      }
      setTestState("ok");
      // Save channel immediately
      await invoke("save_config", {
        config: {
          ...config,
          telegram_token: token.trim(),
          private_chat_id: chatId.trim(),
          private_chat_title: chatTitle || null,
          private_verified: true,
          private_verified_at: new Date().toISOString(),
          private_verified_fingerprint: `${token.trim()}::${chatId.trim()}`,
        },
      });
      // Auto-advance after 1s
      setTimeout(() => setStep(2), 1000);
    } catch (e) {
      setTestState("error");
      setTestError("Test failed. Check the bot is added to this channel.");
    }
  };

  // Step 3: Save DJ software + complete
  const handleComplete = async () => {
    const finalConfig = {
      ...config,
      telegram_token: token.trim(),
      private_chat_id: chatId.trim(),
      private_chat_title: chatTitle || null,
      private_verified: true,
      private_verified_at: config?.private_verified_at || new Date().toISOString(),
      private_verified_fingerprint: `${token.trim()}::${chatId.trim()}`,
      dj_software: djSoftware,
      onboarding_done: true,
    };
    onComplete(finalConfig);
  };

  const selectedDj = DJ_OPTIONS.find((o) => o.value === djSoftware);

  const handleSkip = async () => {
    onComplete({ ...config, onboarding_done: true });
  };

  return (
    <div className="wizard-backdrop">
      <div className="wizard-card">
        {/* Step dots */}
        <div className="wizard-dots">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`wizard-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            />
          ))}
        </div>

        {/* Step 0: Token */}
        {step === 0 && (
          <div className="wizard-step">
            <h2 className="wizard-title">Create your Telegram bot</h2>
            <div className="wizard-body">
              <ol className="wizard-instructions">
                <li>
                  Open{" "}
                  <a
                    className="wizard-link"
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @BotFather
                  </a>{" "}
                  in Telegram
                </li>
                <li>
                  Send <code>/newbot</code> and follow the prompts
                </li>
                <li>Copy the bot token and paste it below</li>
              </ol>
              <input
                className="tc-input"
                type="text"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setVerifyState("idle");
                  setVerifyError("");
                }}
                placeholder="123456:ABC-DEF1234..."
                spellCheck={false}
                autoFocus
              />
              {verifyError && <div className="input-error">{verifyError}</div>}
            </div>
            <div className="wizard-actions">
              <button
                className={`wizard-action-btn ${verifyState === "busy" ? "busy" : ""} ${verifyState === "ok" ? "ok" : ""}`}
                onClick={handleVerifyToken}
                disabled={!token.trim() || verifyState === "busy" || verifyState === "ok"}
              >
                <span className="wizard-btn-label" style={{ opacity: verifyState === "idle" || verifyState === "error" ? 1 : 0 }}>
                  Verify token
                </span>
                <span className="wizard-btn-spinner" style={{ opacity: verifyState === "busy" ? 1 : 0 }} />
                <span className="wizard-btn-ok" style={{ opacity: verifyState === "ok" ? 1 : 0 }}>
                  Verified
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Channel */}
        {step === 1 && (
          <div className="wizard-step">
            <h2 className="wizard-title">Connect your channel</h2>
            <div className="wizard-body">
              <p className="wizard-body-hint">
                Add your bot to a Telegram channel or group, then detect it below.
              </p>

              {!manualEntry && channels.length === 0 && !chatId && (
                <button
                  className="inline-btn"
                  onClick={handleDetect}
                  disabled={detectState === "busy"}
                  style={{ alignSelf: "flex-start" }}
                >
                  {detectState === "busy" ? (
                    <span className="btn-spinner" aria-hidden="true" />
                  ) : (
                    "Detect channels"
                  )}
                </button>
              )}

              {channels.length > 0 && (
                <div className="channel-detect-list">
                  {channels.map((ch) => (
                    <button
                      key={ch.chat_id}
                      className="channel-detect-item"
                      onClick={() => handleSelectChannel(ch)}
                    >
                      <span className="channel-detect-title">{ch.title}</span>
                      <span className="channel-detect-id">{ch.chat_id}</span>
                    </button>
                  ))}
                </div>
              )}

              {detectError && <div className="input-error">{detectError}</div>}

              {chatId && !manualEntry && (
                <div className="input-row">
                  <div className="select-locked" style={{ flex: 1 }}>
                    <span className="select-check">&#10003;</span>
                    <span>{chatTitle || chatId}</span>
                  </div>
                  <button
                    className="inline-btn"
                    onClick={() => {
                      setChatId("");
                      setChatTitle("");
                      setTestState("idle");
                      setTestError("");
                    }}
                  >
                    change
                  </button>
                </div>
              )}

              {manualEntry && (
                <input
                  className="tc-input"
                  type="text"
                  value={chatId}
                  onChange={(e) => {
                    setChatId(e.target.value);
                    setChatTitle("");
                    setTestState("idle");
                    setTestError("");
                  }}
                  placeholder="@yourchannel or -1001234567890"
                  spellCheck={false}
                />
              )}

              {!chatId && !manualEntry && channels.length === 0 && detectState !== "busy" && (
                <button
                  className="wizard-manual-link"
                  onClick={() => setManualEntry(true)}
                >
                  Or enter channel ID manually
                </button>
              )}

              {testError && <div className="input-error">{testError}</div>}
            </div>
            <div className="wizard-actions">
              <button className="inline-btn" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                className={`wizard-action-btn ${testState === "busy" ? "busy" : ""} ${testState === "ok" ? "ok" : ""}`}
                onClick={handleTestChannel}
                disabled={!chatId.trim() || testState === "busy" || testState === "ok"}
              >
                <span className="wizard-btn-label" style={{ opacity: testState === "idle" || testState === "error" ? 1 : 0 }}>
                  Test connection
                </span>
                <span className="wizard-btn-spinner" style={{ opacity: testState === "busy" ? 1 : 0 }} />
                <span className="wizard-btn-ok" style={{ opacity: testState === "ok" ? 1 : 0 }}>
                  Connected
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: DJ Software */}
        {step === 2 && (
          <div className="wizard-step">
            <h2 className="wizard-title">Pick your DJ software</h2>
            <div className="wizard-body">
              <div className="wizard-dj-grid">
                {DJ_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`wizard-dj-option ${djSoftware === opt.value ? "selected" : ""}`}
                    onClick={() => setDjSoftware(opt.value)}
                  >
                    <span>{opt.label}</span>
                    <span className={`dj-badge ${opt.badge}`}>
                      {BADGE_LABELS[opt.badge]}
                    </span>
                  </button>
                ))}
              </div>
              {selectedDj?.badge === "beta" && (
                <p className="wizard-beta-note">
                  Beta support — basic functionality works but may have edge cases.
                  Report issues on GitHub.
                </p>
              )}
            </div>
            <div className="wizard-actions">
              <button className="inline-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="inline-btn"
                onClick={() => setStep(3)}
              >
                {djSoftware ? "Continue" : "Skip for now"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 3 && (
          <div className="wizard-step">
            <h2 className="wizard-title">All set!</h2>
            <div className="wizard-body">
              <div className="wizard-summary">
                <div className="wizard-summary-row">
                  <span className="wizard-summary-label">Bot</span>
                  <span className="wizard-summary-value">{botName || "Connected"}</span>
                </div>
                <div className="wizard-summary-row">
                  <span className="wizard-summary-label">Channel</span>
                  <span className="wizard-summary-value">{chatTitle || chatId}</span>
                </div>
                <div className="wizard-summary-row">
                  <span className="wizard-summary-label">Software</span>
                  <span className="wizard-summary-value">
                    {selectedDj?.label || "Not selected"}
                    {selectedDj && (
                      <span className={`dj-badge ${selectedDj.badge}`} style={{ marginLeft: 8 }}>
                        {BADGE_LABELS[selectedDj.badge]}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="wizard-actions">
              <button className="inline-btn" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="btn-broadcast start"
                onClick={handleComplete}
              >
                Start broadcasting
              </button>
            </div>
          </div>
        )}

        {/* Skip link */}
        {step < 3 && (
          <button className="wizard-skip" onClick={handleSkip}>
            Skip setup, I'll configure later
          </button>
        )}
      </div>
    </div>
  );
}
