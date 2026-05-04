import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

const HISTORY_SORT_KEY = "trackcast-history-sort-mode";
const HISTORY_NAMES_KEY = "trackcast-history-set-names";

export default function HistoryView() {
  const [setHistory, setSetHistory] = useState([]);
  const [openSetFilename, setOpenSetFilename] = useState(null);
  const [setDetailsByFilename, setSetDetailsByFilename] = useState({});
  const [loadingSetFilename, setLoadingSetFilename] = useState(null);
  const [exportingFile, setExportingFile] = useState(null);
  const [deletingFile, setDeletingFile] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [setNames, setSetNames] = useState(() => {
    try {
      const raw = localStorage.getItem(HISTORY_NAMES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [sortMode, setSortMode] = useState(() => {
    try {
      const saved =
        localStorage.getItem(HISTORY_SORT_KEY) ||
        localStorage.getItem("trackcast-history-filter-mode");
      if (saved === "date" || saved === "name" || saved === "newest") return saved;
      return "newest";
    } catch (_) {
      return "newest";
    }
  });

  const refreshHistory = () => {
    invoke("get_set_history").then(setSetHistory).catch(() => {});
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_SORT_KEY, sortMode);
    } catch (_) {}
  }, [sortMode]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!sortRef.current) return;
      if (!sortRef.current.contains(event.target)) {
        setSortOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_NAMES_KEY, JSON.stringify(setNames));
    } catch (_) {}
  }, [setNames]);

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
    const customName = (setNames[setSummary.filename] || "").trim();
    if (customName) return customName;
    const duration = formatDuration(setSummary.start_time, setSummary.end_time);
    return `${setSummary.date}${duration ? ` · ${duration}` : ""}`;
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
      setOpenSetFilename((prev) => (prev === filename ? null : prev));
      setSetDetailsByFilename((prev) => {
        if (!prev[filename]) return prev;
        const next = { ...prev };
        delete next[filename];
        return next;
      });
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

  const getPrimaryLabel = (s, grouped) => {
    const customName = (setNames[s.filename] || "").trim();
    if (customName) return customName;
    return grouped ? s.start_time : s.date;
  };

  const startRename = (s, grouped) => {
    setEditingNameId(s.filename);
    setEditingNameValue(getPrimaryLabel(s, grouped));
  };

  const cancelRename = () => {
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const confirmRename = (filename) => {
    const next = editingNameValue.trim();
    setSetNames((prev) => {
      const updated = { ...prev };
      if (!next) {
        delete updated[filename];
      } else {
        updated[filename] = next;
      }
      return updated;
    });
    cancelRename();
  };

  const toggleSetOpen = async (setSummary) => {
    const filename = setSummary.filename;
    if (openSetFilename === filename) {
      setOpenSetFilename(null);
      return;
    }
    setOpenSetFilename(filename);
    if (setDetailsByFilename[filename]) return;
    setLoadingSetFilename(filename);
    try {
      const details = await invoke("get_set_by_filename", { filename });
      setSetDetailsByFilename((prev) => ({ ...prev, [filename]: details }));
    } catch (e) {
      console.error("Load set details failed", e);
    }
    setLoadingSetFilename((current) => (current === filename ? null : current));
  };

  const renderSetRow = (s, grouped = false) => {
    const duration = formatDuration(s.start_time, s.end_time);
    const durationLabel = duration || "duration n/a";
    const timeLabel = s.start_time;
    const tracksLabel = `${s.track_count} track${s.track_count !== 1 ? "s" : ""}`;
    const meta = grouped
      ? `${durationLabel} · ${tracksLabel}`
      : `${durationLabel} · ${tracksLabel} · ${timeLabel}`;
    const isRenaming = editingNameId === s.filename;
    const isOpen = openSetFilename === s.filename;
    const setDetails = setDetailsByFilename[s.filename];
    const isLoadingDetails = isOpen && loadingSetFilename === s.filename && !setDetails;
    const tracks = setDetails?.tracks || [];
    return (
      <div key={s.filename} className="history-item-block">
        <div
          className={`log-item history-item ${isRenaming ? "is-editing" : ""} ${isOpen ? "is-open" : ""}`}
          onClick={() => {
            if (!isRenaming) void toggleSetOpen(s);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isRenaming) void toggleSetOpen(s);
            }
          }}
          aria-expanded={isOpen}
        >
          <div className="log-track history-item-main">
            {isRenaming ? (
              <input
                className="tc-input history-name-input"
                type="text"
                value={editingNameValue}
                onChange={(e) => setEditingNameValue(e.target.value)}
                onBlur={() => confirmRename(s.filename)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmRename(s.filename);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                spellCheck={false}
              />
            ) : (
              <div className="history-name-row">
                <button
                  className="log-artist history-name-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(s, grouped);
                  }}
                  title="Rename set"
                >
                  {getPrimaryLabel(s, grouped)}
                </button>
              </div>
            )}
            <div className="log-title">{meta}</div>
          </div>
          <div className="history-item-actions">
            <button
              className="inline-btn"
              disabled={exportingFile === s.filename || deletingFile === s.filename}
              onClick={(e) => {
                e.stopPropagation();
                handleExportFile(s.filename, s.date);
              }}
            >
              {exportingFile === s.filename ? "···" : "export"}
            </button>
            <button
              className="history-delete-btn"
              disabled={deletingFile === s.filename || exportingFile === s.filename}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(s);
              }}
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
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="history-item-detail">
            {isLoadingDetails ? (
              <div className="log-empty">Loading set...</div>
            ) : tracks.length === 0 ? (
              <div className="log-empty">No tracks in this set</div>
            ) : (
              tracks.map((track, i) => (
                <div key={`${s.filename}-${i}`} className={`log-item history-track-item ${i === 0 ? "current" : ""}`}>
                  <span className="log-time">{track.time}</span>
                  <div className="log-track">
                    <div className="log-artist">{track.artist || "Unknown"}</div>
                    <div className="log-title">{track.title || "Unknown"}</div>
                  </div>
                  {track.bpm && <span className="log-bpm">{Math.round(track.bpm)}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const groupedHistory = setHistory.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const toggleGroup = (date) => {
    setExpandedGroups((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const byNameHistory = [...setHistory].sort((a, b) => {
    const aLabel = ((setNames[a.filename] || "").trim() || `${a.date} ${a.start_time}`).toLowerCase();
    const bLabel = ((setNames[b.filename] || "").trim() || `${b.date} ${b.start_time}`).toLowerCase();
    return aLabel.localeCompare(bLabel);
  });

  const sortOptions = [
    { value: "newest", label: "Latest" },
    { value: "date", label: "Grouped" },
    { value: "name", label: "Name" },
  ];
  const currentSortLabel = sortOptions.find((o) => o.value === sortMode)?.label || "Latest";
  const sortTriggerWidth = Math.max(56, Math.round(currentSortLabel.length * 6.6 + 22));

  return (
    <>
      <div className="log-header history-view-header">
        <span className="log-label">History</span>
        <div className="history-header-right">
          <div className={`history-sort-wrap ${sortOpen ? "open" : ""}`} ref={sortRef}>
            <button
              className="history-sort-trigger"
              onClick={() => setSortOpen((v) => !v)}
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
              style={{ width: `${sortTriggerWidth}px` }}
            >
              {currentSortLabel}
            </button>
            <span className="history-sort-caret" aria-hidden="true">
              <svg viewBox="0 0 12 8" width="9" height="6">
                <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            {sortOpen && (
              <div className="history-sort-menu" role="listbox" aria-label="Sort history">
                {sortOptions
                  .filter((option) => option.value !== sortMode)
                  .map((option) => (
                  <button
                    key={option.value}
                    className="history-sort-option"
                    onClick={() => {
                      setSortMode(option.value);
                      setSortOpen(false);
                    }}
                    role="option"
                    aria-selected="false"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={`log-list history-list ${sortMode === "date" ? "history-list-grouped" : ""}`}>
        {setHistory.length === 0 ? (
          <div className="log-empty history-empty">No saved sets yet</div>
        ) : sortMode === "date" ? (
          Object.entries(groupedHistory).map(([date, sets]) => (
            <div className="history-group" key={date}>
              <button
                className="history-group-label"
                onClick={() => toggleGroup(date)}
              >
                <span className="history-group-date">{date}</span>
                <span className="history-group-meta">
                  {sets.length} set{sets.length !== 1 ? "s" : ""}
                </span>
                <span className={`history-group-caret ${expandedGroups[date] ? "open" : ""}`}>
                  ▾
                </span>
              </button>
              {expandedGroups[date] ? sets.map((s) => renderSetRow(s, true)) : null}
            </div>
          ))
        ) : sortMode === "name" ? (
          byNameHistory.map((s) => renderSetRow(s, false))
        ) : (
          setHistory.map((s) => renderSetRow(s, false))
        )}
      </div>
      {deleteCandidate && (
        <div className="tc-modal-backdrop">
          <div className="tc-modal">
            <div className="tc-modal-header" />
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
