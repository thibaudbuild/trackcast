import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export default function HistoryView() {
  const [setHistory, setSetHistory] = useState([]);
  const [exportingFile, setExportingFile] = useState(null);

  useEffect(() => {
    invoke("get_set_history").then(setSetHistory).catch(() => {});
  }, []);

  const handleExportFile = async (filename, date) => {
    setExportingFile(filename);
    try {
      const txt = await invoke("export_set_by_filename", { filename });
      const savePath = await save({
        defaultPath: `TrackCast_${date}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (savePath) await writeTextFile(savePath, txt);
    } catch (e) {
      console.error("Export failed", e);
    }
    setExportingFile(null);
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`;
  };

  return (
    <div className="log-list" style={{ flex: 1 }}>
      {setHistory.length === 0 ? (
        <div className="log-empty">No sets recorded yet.</div>
      ) : (
        setHistory.map((s) => {
          const duration = formatDuration(s.start_time, s.end_time);
          const durationLabel = duration || "duration n/a";
          return (
            <div key={s.filename} className="log-item" style={{ alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="log-artist">{s.date}</div>
                <div className="log-title">
                  {s.start_time}{s.end_time ? ` → ${s.end_time}` : ""}
                  {" · "}{durationLabel}
                  {" · "}{s.track_count} track{s.track_count !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                className="inline-btn"
                style={{ flexShrink: 0 }}
                disabled={exportingFile === s.filename}
                onClick={() => handleExportFile(s.filename, s.date)}
              >
                {exportingFile === s.filename ? "···" : "export"}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
