import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

export default function HistoryView() {
  const [setHistory, setSetHistory] = useState([]);
  const [exportingFile, setExportingFile] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const refreshHistory = () => {
    invoke("get_set_history").then(setSetHistory).catch(() => {});
  };

  useEffect(() => {
    refreshHistory();
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

  const getSetLabel = (setSummary) => {
    if (!setSummary) return "this set";
    return `${setSummary.date} ${setSummary.start_time}${setSummary.end_time ? ` → ${setSummary.end_time}` : ""}`;
  };

  const handleDeleteFile = async (setSummary) => {
    setDeleteCandidate({
      filename: setSummary.filename,
      label: getSetLabel(setSummary),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    const filename = deleteCandidate.filename;
    setDeletingFile(filename);
    try {
      await invoke("delete_set_by_filename", { filename });
      refreshHistory();
    } catch (e) {
      console.error("Delete failed", e);
    }
    setDeletingFile(null);
    setDeleteCandidate(null);
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
    <>
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
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button
                    className="inline-btn"
                    disabled={exportingFile === s.filename || deletingFile === s.filename}
                    onClick={() => handleExportFile(s.filename, s.date)}
                  >
                    {exportingFile === s.filename ? "···" : "export"}
                  </button>
                  <button
                    className="history-delete-btn"
                    disabled={deletingFile === s.filename || exportingFile === s.filename}
                    onClick={() => handleDeleteFile(s)}
                    title="Delete set"
                    aria-label="Delete set"
                  >
                    {deletingFile === s.filename ? (
                      "···"
                    ) : (
                      <svg viewBox="0 0 24 24" className="history-delete-icon" aria-hidden="true">
                        <path
                          d="M9 3h6m-9 4h12M10 10v7m4-7v7M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      {deleteCandidate && (
        <div className="tc-modal-backdrop">
          <div className="tc-modal">
            <div className="tc-modal-title">Delete Set</div>
            <div className="tc-modal-text">Delete "{deleteCandidate.label}" permanently?</div>
            <div className="tc-modal-actions">
              <button className="inline-btn" onClick={() => setDeleteCandidate(null)} disabled={!!deletingFile}>
                Cancel
              </button>
              <button className="inline-btn tc-danger-btn" onClick={handleConfirmDelete} disabled={!!deletingFile}>
                {deletingFile ? "···" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
