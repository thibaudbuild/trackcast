use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub time: String,
    pub artist: String,
    pub title: String,
    pub bpm: Option<f64>,
    pub key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DjSet {
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub tracks: Vec<HistoryEntry>,
}

impl DjSet {
    pub fn new() -> Self {
        let now = Local::now();
        Self {
            date: now.format("%Y-%m-%d").to_string(),
            start_time: now.format("%H:%M").to_string(),
            end_time: None,
            tracks: vec![],
        }
    }
}

/// Lightweight summary for the History tab (no track list needed)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetSummary {
    pub filename: String,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub track_count: usize,
}

fn sets_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join("TrackCast").join("sets")
}

pub fn save_set(set: &DjSet) -> Result<(), Box<dyn std::error::Error>> {
    let dir = sets_dir();
    fs::create_dir_all(&dir)?;

    let filename = format!("{}_{}.json", set.date, set.start_time.replace(":", "-"));
    let path = dir.join(filename);
    let json = serde_json::to_string_pretty(set)?;
    fs::write(path, json)?;
    Ok(())
}

/// Load all saved sets as summaries (for the History tab)
pub fn load_set_history() -> Vec<SetSummary> {
    let dir = sets_dir();
    let mut summaries: Vec<SetSummary> = vec![];

    let Ok(entries) = fs::read_dir(&dir) else { return summaries; };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let Ok(content) = fs::read_to_string(&path) else { continue; };
        let Ok(set) = serde_json::from_str::<DjSet>(&content) else { continue; };

        summaries.push(SetSummary {
            filename,
            date: set.date,
            start_time: set.start_time,
            end_time: set.end_time,
            track_count: set.tracks.len(),
        });
    }

    // Most recent first
    summaries.sort_by(|a, b| b.filename.cmp(&a.filename));
    summaries
}

/// Load and export a specific saved set as TXT
pub fn export_set_by_filename(filename: &str) -> Result<String, String> {
    let path = sets_dir().join(filename);
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let set = serde_json::from_str::<DjSet>(&content).map_err(|e| e.to_string())?;
    Ok(export_set_txt(&set))
}

pub fn delete_set_by_filename(filename: &str) -> Result<(), String> {
    let path = sets_dir().join(filename);
    if !path.exists() {
        return Err("Set file not found".to_string());
    }
    fs::remove_file(path).map_err(|e| e.to_string())
}

pub fn export_set_txt(set: &DjSet) -> String {
    let mut lines = Vec::new();
    lines.push(format!("TrackCast — Set du {}", set.date));
    lines.push("================================".to_string());

    for entry in &set.tracks {
        let bpm_str = entry
            .bpm
            .map(|b| format!(" ({:.0} BPM)", b))
            .unwrap_or_default();
        lines.push(format!(
            "{} — {} - {}{}",
            entry.time, entry.artist, entry.title, bpm_str
        ));
    }

    lines.push("================================".to_string());

    let track_count = set.tracks.len();
    lines.push(format!("{} tracks", track_count));

    lines.join("\n")
}
