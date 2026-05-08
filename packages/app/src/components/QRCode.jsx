import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QRCodeSection({ publicChatId }) {
  const username = useMemo(() => {
    if (!publicChatId) return "";
    const trimmed = publicChatId.trim();
    if (trimmed.startsWith("@")) return trimmed.slice(1);
    return "";
  }, [publicChatId]);

  const url = useMemo(() => {
    if (!username) return "";
    return `https://t.me/${username}`;
  }, [username]);

  if (!username) {
    return (
      <div className="qr-empty">
        Set up a public channel to enable QR sharing
      </div>
    );
  }

  return (
    <div className="qr-section">
      <div className="qr-code-wrap">
        <QRCodeSVG
          value={url}
          size={72}
          bgColor="transparent"
          fgColor="#000000"
          level="M"
        />
      </div>
      <div className="qr-hint">
        Scan to open{" "}
        <a href={url} target="_blank" rel="noopener noreferrer">
          @{username}
        </a>{" "}
        in Telegram
      </div>
    </div>
  );
}
