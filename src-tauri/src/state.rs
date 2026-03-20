use crate::history::DjSet;
use crate::unbox::TrackInfo;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UserConfig {
    pub telegram_token: String,
    pub telegram_chat_id: String,
    pub telegram_verified: bool,
    pub telegram_verified_at: Option<String>,
    pub telegram_verified_fingerprint: Option<String>,
    pub dj_software: String,
    pub onboarding_done: bool,
    // Display / message format
    pub set_name: String,          // e.g. "Live @ Berghain" — shown in Telegram messages
    pub message_template: String,  // e.g. "🎵 {set_name} · {artist} — {title}"
    pub show_bpm: bool,
    pub show_key: bool,
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            telegram_token: String::new(),
            telegram_chat_id: String::new(),
            telegram_verified: false,
            telegram_verified_at: None,
            telegram_verified_fingerprint: None,
            dj_software: String::new(),
            onboarding_done: false,
            set_name: String::new(),
            message_template: "🎵 {artist} — {title}".to_string(),
            show_bpm: true,
            show_key: false,
        }
    }
}

pub struct AppState {
    pub is_tracking: bool,
    pub current_track: Option<TrackInfo>,
    pub current_set: Option<DjSet>,
    pub unbox_connected: bool,
    pub unbox_listener_started: bool,
    pub session_config: Option<UserConfig>,
    pub config: UserConfig,
}

fn config_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join("TrackCast")
}

pub fn save_config(config: &UserConfig) -> Result<(), Box<dyn std::error::Error>> {
    let dir = config_dir();
    fs::create_dir_all(&dir)?;
    let path = dir.join("config.json");
    let json = serde_json::to_string_pretty(config)?;
    fs::write(path, json)?;
    Ok(())
}

pub fn load_config() -> Result<UserConfig, Box<dyn std::error::Error>> {
    let path = config_dir().join("config.json");
    let content = fs::read_to_string(path)?;
    let config: UserConfig = serde_json::from_str(&content)?;
    Ok(config)
}
