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
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [collapsedDays, setCollapsedDays] = useState(() => new Set());
  const [sortMode, setSortMode] = useState(() => {
    try {
      const saved =
        localStorage.getItem(HISTORY_SORT_KEY) ||
        localStorage.getItem("trackcast-history-filter-mode");
      // Two modes now: "date" (newest first, deduplicated day headers) and "name" (A–Z).
      // "newest" was the old flat mode — fold into "date".
      if (saved === "name") return "name";
      return "date";
    } catch (_) {
      return "date";
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

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return dateStr;
    const [, y, mo, d] = m;
    const setDate = new Date(Number(y), Number(mo) - 1, Number(d));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - setDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    const sameYear = setDate.getFullYear() === today.getFullYear();
    return setDate.toLocaleDateString(undefined, sameYear
      ? { month: "long", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" });
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

  const getPrimaryLabel = (s) => {
    const customName = (setNames[s.filename] || "").trim();
    if (customName) return customName;
    return formatDateLabel(s.date);
  };

  const startRename = (s) => {
    setEditingNameId(s.filename);
    setEditingNameValue(getPrimaryLabel(s));
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

  const renderSetRow = (s) => {
    const duration = formatDuration(s.start_time, s.end_time);
    const durationLabel = duration || "duration n/a";
    const tracksLabel = `${s.track_count} track${s.track_count !== 1 ? "s" : ""}`;
    const meta = `${s.start_time} · ${durationLabel} · ${tracksLabel}`;
    const isRenaming = editingNameId === s.filename;
    const isOpen = openSetFilename === s.filename;
    const setDetails = setDetailsByFilename[s.filename];
    const isLoadingDetails = isOpen && loadingSetFilename === s.filename && !setDetails;
    const tracks = setDetails?.tracks || [];
    const displayName = getPrimaryLabel(s);

    return (
      <div key={s.filename} className="history-item-block">
        <div
          className={`log-item history-item ${isRenaming ? "is-editing" : ""} ${isOpen ? "is-open" : ""}`}
          onClick={() => { if (!isRenaming) void toggleSetOpen(s); }}
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
              <div className="log-artist history-name">{displayName}</div>
            )}
            <div className="log-title">{meta}</div>
          </div>
          <div className="history-item-actions">
            <button
              className="history-action-btn"
              onClick={(e) => { e.stopPropagation(); startRename(s); }}
              title="Rename set"
              aria-label="Rename set"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M14 4l6 6-10 10H4v-6L14 4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className="history-action-btn"
              disabled={exportingFile === s.filename || deletingFile === s.filename}
              onClick={(e) => { e.stopPropagation(); handleExportFile(s.filename, s.date); }}
              title="Export tracklist"
              aria-label="Export tracklist"
            >
              {exportingFile === s.filename ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M12 3v11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M7.5 10.5 12 15l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 17.5v1.8c0 1.5 1.2 2.7 2.7 2.7h8.6c1.5 0 2.7-1.2 2.7-2.7v-1.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <button
              className="history-action-btn danger"
              disabled={deletingFile === s.filename || exportingFile === s.filename}
              onClick={(e) => { e.stopPropagation(); handleDeleteFile(s); }}
              title="Delete set"
              aria-label="Delete set"
            >
              {deletingFile === s.filename ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
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
          <span className={`history-item-caret ${isOpen ? "open" : ""}`} aria-hidden="true">
            <svg viewBox="0 0 12 8" width="9" height="6">
              <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
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

  const byNameHistory = [...setHistory].sort((a, b) => {
    const aLabel = ((setNames[a.filename] || "").trim() || `${a.date} ${a.start_time}`).toLowerCase();
    const bLabel = ((setNames[b.filename] || "").trim() || `${b.date} ${b.start_time}`).toLowerCase();
    return aLabel.localeCompare(bLabel);
  });

  const sortOptions = [
    { value: "date", label: "By date" },
    { value: "name", label: "A–Z" },
  ];
  const currentSortLabel = sortOptions.find((o) => o.value === sortMode)?.label || "By date";
  const sortTriggerWidth = Math.max(64, Math.round(currentSortLabel.length * 6.6 + 22));

  const toggleDay = (date) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const renderByDate = () => {
    const dayCounts = {};
    for (const s of setHistory) {
      dayCounts[s.date] = (dayCounts[s.date] || 0) + 1;
    }
    const result = [];
    let lastDate = null;
    for (const s of setHistory) {
      if (s.date !== lastDate) {
        const isCollapsed = collapsedDays.has(s.date);
        const count = dayCounts[s.date];
        result.push(
          <button
            key={`day-${s.date}`}
            className={`history-day-header ${isCollapsed ? "collapsed" : ""}`}
            onClick={() => toggleDay(s.date)}
            aria-expanded={!isCollapsed}
          >
            <span className="history-day-caret" aria-hidden="true">
              <svg viewBox="0 0 12 8" width="9" height="6">
                <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="history-day-label">{formatDateLabel(s.date)}</span>
            <span className="history-day-count">{count} set{count !== 1 ? "s" : ""}</span>
          </button>
        );
        lastDate = s.date;
      }
      if (!collapsedDays.has(s.date)) {
        result.push(renderSetRow(s));
      }
    }
    return result;
  };

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
      <div className="log-list history-list">
        {setHistory.length === 0 ? (
          <div className="log-empty history-empty">
            No sets yet — start broadcasting from the Live tab to save your first set.
          </div>
        ) : sortMode === "name" ? (
          byNameHistory.map((s) => renderSetRow(s))
        ) : (
          renderByDate()
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
