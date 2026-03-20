use crate::history::HistoryEntry;
use crate::state::{AppState, UserConfig};
use crate::telegram;
use chrono::Local;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::connect_async;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackInfo {
    pub artist: Option<String>,
    #[serde(alias = "track")]
    pub title: Option<String>,
    pub album: Option<String>,
    pub label: Option<String>,
    pub remix: Option<String>,
    pub bpm: Option<f64>,
    pub key: Option<String>,
    pub genre: Option<String>,
    pub artwork: Option<String>,
}

impl TrackInfo {
    pub fn display_name(&self) -> String {
        let artist = self.artist.as_deref().unwrap_or("Unknown Artist");
        let title = self.title.as_deref().unwrap_or("Unknown Track");
        format!("{} — {}", artist, title)
    }

    pub fn is_same_as(&self, other: &TrackInfo) -> bool {
        let norm = |s: &Option<String>| s.as_deref().unwrap_or("").trim().to_lowercase();
        norm(&self.artist) == norm(&other.artist) && norm(&self.title) == norm(&other.title)
    }

    pub fn is_empty(&self) -> bool {
        let artist_empty = self
            .artist
            .as_ref()
            .map_or(true, |a| a.trim().is_empty());
        let title_empty = self
            .title
            .as_ref()
            .map_or(true, |t| t.trim().is_empty());
        artist_empty && title_empty
    }
}

/// Launch Unbox sidecar and listen to its WebSocket for track changes
pub async fn run_unbox_listener(app_handle: tauri::AppHandle, state: Arc<Mutex<AppState>>) {
    // Unbox is launched/relaunched by start_tracking.
    // Here we only keep a resilient WebSocket listener loop alive.
    loop {
        match connect_to_unbox(&app_handle, &state).await {
            Ok(_) => {
                println!("[TrackCast] WebSocket connection closed, reconnecting...");
            }
            Err(e) => {
                println!("[TrackCast] WebSocket error: {}, retrying in 3s...", e);
            }
        }

        // Mark as disconnected
        {
            let mut s = state.lock().await;
            s.unbox_connected = false;
        }
        let _ = app_handle.emit("unbox-status", false);

        sleep(Duration::from_secs(3)).await;
    }
}

pub async fn restart_unbox_for_software(software: String) {
    // Resolve binary path
    let binary_name = if cfg!(target_arch = "aarch64") {
        "unbox-aarch64-apple-darwin"
    } else {
        "unbox-x86_64-apple-darwin"
    };
    let binary_path = if cfg!(debug_assertions) {
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(binary_name)
    } else {
        std::env::current_exe()
            .unwrap()
            .parent()
            .unwrap()
            .to_path_buf()
            .join(binary_name)
    };

    println!(
        "[TrackCast] Launching Unbox in background for software '{}': {:?}",
        software, binary_path
    );

    // Map DJ software to menu position in Unbox TUI
    let menu_index: usize = match software.as_str() {
        "rekordbox" => 0,
        "serato"    => 1,
        "traktor"   => 2,
        "virtualdj" => 3,
        "mixxx"     => 4,
        "djuced"    => 5,
        "djay"      => 6,
        "denon"     => 7,
        _           => 0,
    };

    // Check if Unbox is already running on port 8080.
    // If so, kill it first so we can relaunch with the correct software selection.
    // (port conflict would cause the new instance to silently fail)
    let port_in_use = tokio::net::TcpStream::connect("127.0.0.1:8080").await.is_ok();
    if port_in_use {
        println!("[TrackCast] Port 8080 already in use — killing listener PID(s) on :8080");

        let pids_out = tokio::process::Command::new("lsof")
            .arg("-tiTCP:8080")
            .arg("-sTCP:LISTEN")
            .output()
            .await;

        match pids_out {
            Ok(out) => {
                let txt = String::from_utf8_lossy(&out.stdout);
                let pids: Vec<String> = txt
                    .lines()
                    .map(|l| l.trim().to_string())
                    .filter(|l| !l.is_empty())
                    .collect();
                if pids.is_empty() {
                    println!("[TrackCast][kill] No LISTEN PID found by lsof");
                } else {
                    for pid in &pids {
                        match tokio::process::Command::new("kill")
                            .arg("-TERM")
                            .arg(pid)
                            .output()
                            .await
                        {
                            Ok(k) => {
                                if k.status.success() {
                                    println!("[TrackCast][kill] TERM sent to PID {}", pid);
                                } else {
                                    println!(
                                        "[TrackCast][kill] TERM failed for PID {}: {}",
                                        pid,
                                        String::from_utf8_lossy(&k.stderr)
                                    );
                                }
                            }
                            Err(e) => println!("[TrackCast][kill] TERM exec failed for PID {}: {}", pid, e),
                        }
                    }
                    sleep(Duration::from_millis(700)).await;

                    // Escalate if still listening
                    let still_in_use = tokio::net::TcpStream::connect("127.0.0.1:8080").await.is_ok();
                    if still_in_use {
                        for pid in &pids {
                            match tokio::process::Command::new("kill")
                                .arg("-KILL")
                                .arg(pid)
                                .output()
                                .await
                            {
                                Ok(k) => {
                                    if !k.status.success() {
                                        println!(
                                            "[TrackCast][kill] KILL failed for PID {}: {}",
                                            pid,
                                            String::from_utf8_lossy(&k.stderr)
                                        );
                                    }
                                }
                                Err(e) => println!("[TrackCast][kill] KILL exec failed for PID {}: {}", pid, e),
                            }
                        }
                        sleep(Duration::from_millis(300)).await;
                    }
                }
            }
            Err(e) => {
                println!("[TrackCast][kill] Failed to query PID on :8080 via lsof: {}", e);
            }
        }
    }

    // Use `expect` (/usr/bin/expect, pre-installed on macOS) to run Unbox in a hidden PTY.
    // `expect` allocates a pseudo-terminal so Unbox thinks it has a real TTY,
    // but no Terminal window ever opens — fully invisible to the user.
    //
    // Keep the launcher deterministic: wait for the TUI to initialize, then send keys.
    // Relying on exact menu text matching is brittle because ANSI rendering can vary.
    let mut script = String::from("log_user 0\n");
    script.push_str("set timeout 20\n");
    script.push_str(&format!("spawn {}\n", binary_path.display()));
    script.push_str("expect -re \"Select DJ Software|Press h for help\"\n");
    script.push_str("after 150\n");
    for _ in 0..menu_index {
        // ESC [ B = down arrow in ANSI escape sequences
        // \[ must be escaped in Tcl double-quoted strings to avoid command substitution
        script.push_str("send \"\\033\\[B\"\nafter 120\n");
    }
    script.push_str("send \"\\r\"\n");
    script.push_str("set timeout 8\n");
    script.push_str("expect {\n");
    script.push_str("  -re \"monitoring started|Integration URLs\" {}\n");
    script.push_str("  timeout {\n");
    script.push_str("    send \" \"\n");
    script.push_str("    set timeout 5\n");
    script.push_str("    expect {\n");
    script.push_str("      -re \"monitoring started|Integration URLs\" {}\n");
    script.push_str("      timeout { puts stderr {[TrackCast][expect] monitoring start not confirmed} }\n");
    script.push_str("    }\n");
    script.push_str("  }\n");
    script.push_str("}\n");
    script.push_str("set timeout -1\n");
    script.push_str("wait\n");

    match tokio::process::Command::new("/usr/bin/expect")
        .arg("-c")
        .arg(&script)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .spawn()
    {
        Ok(_child) => {
            println!("[TrackCast] Unbox launched in background via expect (software index: {})", menu_index);
        }
        Err(e) => {
            println!("[TrackCast] Failed to launch Unbox via expect: {}", e);
        }
    }

}

async fn connect_to_unbox(
    app_handle: &tauri::AppHandle,
    state: &Arc<Mutex<AppState>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = "ws://127.0.0.1:8080/ws";
    let (ws_stream, _) = connect_async(url).await?;
    println!("[TrackCast] Connected to Unbox WebSocket");

    // Mark as connected
    {
        let mut s = state.lock().await;
        s.unbox_connected = true;
    }
    let _ = app_handle.emit("unbox-status", true);

    let (_write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                match serde_json::from_str::<TrackInfo>(&text) {
                    Ok(track) => handle_track_change(app_handle, state, track).await,
                    Err(e) => println!("[TrackCast] JSON parse error: {} — raw: {}", e, text),
                }
            }
            Ok(_) => {}
            Err(e) => {
                println!("[TrackCast] WebSocket read error: {}", e);
                break;
            }
        }
    }

    Ok(())
}

async fn handle_track_change(
    app_handle: &tauri::AppHandle,
    state: &Arc<Mutex<AppState>>,
    track: TrackInfo,
) {
    // Skip empty tracks
    if track.is_empty() {
        return;
    }

    let mut s = state.lock().await;

    // Drop the stale snapshot sent right after Start.
    // The first incoming track event after Start is ignored by design.
    if s.is_tracking && s.skip_first_track_after_start {
        s.skip_first_track_after_start = false;
        return;
    }

    // Anti-duplicate: if same as current track (normalized), update display but skip log
    if let Some(ref current) = s.current_track {
        if track.is_same_as(current) {
            return;
        }
    }

    // New track — update display
    s.current_track = Some(track.clone());
    let _ = app_handle.emit("track-changed", &track);

    // If not tracking, nothing more to do
    if !s.is_tracking {
        return;
    }

    // Add to history
    let entry = HistoryEntry {
        time: Local::now().format("%H:%M").to_string(),
        artist: track.artist.clone().unwrap_or_default(),
        title: track.title.clone().unwrap_or_default(),
        bpm: track.bpm,
        key: track.key.clone(),
    };

    if let Some(ref mut set) = s.current_set {
        set.tracks.push(entry);
    }

    // Send to Telegram with the immutable session snapshot (if available)
    let runtime_config = s
        .session_config
        .clone()
        .unwrap_or_else(|| s.config.clone());
    let token = runtime_config.telegram_token.clone();
    let chat_id = runtime_config.telegram_chat_id.clone();
    let message = build_message(&track, &runtime_config);

    if !token.is_empty() && !chat_id.is_empty() {
        let app_handle_clone = app_handle.clone();
        let display = track.display_name();
        // Release lock before async call
        drop(s);
        tokio::spawn(async move {
            match telegram::send_message(&token, &chat_id, &message).await {
                Ok(_) => {
                    let _ = app_handle_clone.emit("telegram-sent", &display);
                }
                Err(e) => {
                    println!("[TrackCast] Telegram send error: {}", e);
                    let _ = app_handle_clone.emit("telegram-error", &e.to_string());
                }
            }
        });
    } else {
        drop(s);
    }
}

/// Build the Telegram message from the config template.
/// Supported placeholders: {artist}, {title}, {bpm}, {key}, {set_name}
pub fn build_message(track: &TrackInfo, config: &UserConfig) -> String {
    let artist = track.artist.as_deref().unwrap_or("Unknown Artist");
    let title  = track.title.as_deref().unwrap_or("Unknown Track");
    let bpm    = track.bpm.map(|b| format!("{:.0}", b)).unwrap_or_default();
    let key    = track.key.as_deref().unwrap_or("");

    let mut msg = config.message_template
        .replace("{artist}", artist)
        .replace("{title}", title)
        .replace("{set_name}", &config.set_name)
        .replace("{bpm}", &bpm)
        .replace("{key}", key);

    // Append BPM / key as suffix if enabled and not already in template
    let mut extras: Vec<String> = vec![];
    if config.show_bpm && !bpm.is_empty() && !config.message_template.contains("{bpm}") {
        extras.push(format!("{} BPM", bpm));
    }
    if config.show_key && !key.is_empty() && !config.message_template.contains("{key}") {
        extras.push(key.to_string());
    }
    if !extras.is_empty() {
        msg = format!("{} [{}]", msg, extras.join(" · "));
    }

    msg
}
