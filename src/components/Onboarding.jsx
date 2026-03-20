import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DJ_SOFTWARE = [
  { id: "traktor", name: "Traktor", icon: "🔴", needsSetup: true },
  { id: "rekordbox", name: "Rekordbox", icon: "⚪", needsSetup: false },
  { id: "serato", name: "Serato", icon: "🔵", needsSetup: true },
  { id: "virtualdj", name: "VirtualDJ", icon: "🟣", needsSetup: false },
  { id: "mixxx", name: "Mixxx", icon: "🟢", needsSetup: false },
  { id: "djuced", name: "DJUCED", icon: "🟡", needsSetup: false },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedSoftware, setSelectedSoftware] = useState(null);
  const [traktorSetup, setTraktorSetup] = useState(false);
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleSelectSoftware = (software) => {
    setSelectedSoftware(software);
  };

  const handleNextFromSoftware = () => {
    if (!selectedSoftware) return;
    if (selectedSoftware.id === "traktor" && !traktorSetup) {
      setStep(2); // Traktor setup step
    } else {
      setStep(3); // Skip to Telegram
    }
  };

  const handleTraktorInit = () => {
    // In production, this would copy the D2 file to the CSI folder
    // For now, mark as done
    setTraktorSetup(true);
    setStep(3);
  };

  const handleTestTelegram = async () => {
    if (!token || !chatId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke("test_telegram", { token, chatId });
      setTestResult({ success: true, message: result });
    } catch (e) {
      setTestResult({ success: false, message: e });
    }
    setTesting(false);
  };

  const handleFinish = () => {
    onComplete({
      dj_software: selectedSoftware.id,
      telegram_token: token,
      telegram_chat_id: chatId,
    });
  };

  return (
    <div className="app onboarding">
      <div className="onboarding-header">
        <div className="logo">TrackCast</div>
        <div className="steps-indicator">
          <span className={step >= 1 ? "active" : ""}>1</span>
          <span className="step-line" />
          <span className={step >= 3 ? "active" : ""}>2</span>
          <span className="step-line" />
          <span className={step >= 4 ? "active" : ""}>3</span>
        </div>
      </div>

      {/* Step 1: Choose DJ Software */}
      {step === 1 && (
        <div className="onboarding-step">
          <h2>What DJ software do you use?</h2>
          <div className="software-grid">
            {DJ_SOFTWARE.map((sw) => (
              <button
                key={sw.id}
                className={`software-card ${selectedSoftware?.id === sw.id ? "selected" : ""}`}
                onClick={() => handleSelectSoftware(sw)}
              >
                <span className="software-icon">{sw.icon}</span>
                <span className="software-name">{sw.name}</span>
              </button>
            ))}
          </div>
          <button
            className="btn-primary"
            onClick={handleNextFromSoftware}
            disabled={!selectedSoftware}
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Traktor D2 Setup */}
      {step === 2 && (
        <div className="onboarding-step">
          <h2>Initialize Traktor connection</h2>
          <p className="step-description">
            TrackCast needs to install a small plugin in Traktor to read your
            track data in real-time. This is a one-time setup.
          </p>
          <div className="info-box">
            <p>
              This will place a D2 configuration file in your Traktor CSI
              folder:
            </p>
            <code>
              /Applications/Native Instruments/Traktor Pro
              3/...Resources/qml/CSI/
            </code>
          </div>
          <button className="btn-primary" onClick={handleTraktorInit}>
            Install connection plugin
          </button>
          {traktorSetup && (
            <div className="status-badge success">Installed</div>
          )}
        </div>
      )}

      {/* Step 3: Telegram Setup */}
      {step === 3 && (
        <div className="onboarding-step">
          <h2>Connect Telegram</h2>
          <p className="step-description">
            TrackCast sends your tracklist to a Telegram channel or group.
          </p>

          <div className="telegram-guide">
            <div className="guide-step">
              <span className="guide-num">1</span>
              <span>
                Open{" "}
                <a
                  href="https://t.me/botfather"
                  target="_blank"
                  rel="noreferrer"
                >
                  @BotFather
                </a>{" "}
                on Telegram
              </span>
            </div>
            <div className="guide-step">
              <span className="guide-num">2</span>
              <span>
                Send <code>/newbot</code> and follow the steps
              </span>
            </div>
            <div className="guide-step">
              <span className="guide-num">3</span>
              <span>Copy the API token below</span>
            </div>
            <div className="guide-step">
              <span className="guide-num">4</span>
              <span>
                Add your bot to a channel/group, then enter the Chat ID (e.g.{" "}
                <code>@yourchannel</code>)
              </span>
            </div>
          </div>

          <div className="form-group">
            <label>Bot Token</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456:ABC-DEF1234..."
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label>Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="@yourchannel or -1001234567890"
              spellCheck={false}
            />
          </div>

          <button
            className="btn-secondary"
            onClick={handleTestTelegram}
            disabled={!token || !chatId || testing}
          >
            {testing ? "Testing..." : "Test connection"}
          </button>

          {testResult && (
            <div
              className={`status-badge ${testResult.success ? "success" : "error"}`}
            >
              {testResult.success ? "Connected" : testResult.message}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={!token || !chatId}
          >
            Start using TrackCast
          </button>
        </div>
      )}
    </div>
  );
}
