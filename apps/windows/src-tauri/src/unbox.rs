use crate::history::HistoryEntry;
use crate::state::{AppState, UserConfig};
use crate::telegram;
use chrono::Local;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};
#[cfg(not(target_os = "macos"))]
use tokio::io::AsyncWriteExt;
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
        let artist_empty = self.artist.as_ref().map_or(true, |a| a.trim().is_empty());
        let title_empty = self.title.as_ref().map_or(true, |t| t.trim().is_empty());
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

pub async fn restart_unbox_for_software(app_handle: &tauri::AppHandle, software: String) {
    let binary_name = unbox_binary_name();
    let binary_path = resolve_unbox_binary_path(app_handle, binary_name);

    println!(
        "[TrackCast] Launching Unbox in background for software '{}': {:?}",
        software, binary_path
    );
    if !binary_path.exists() {
        println!(
            "[TrackCast] Unbox binary not found at expected path: {:?}",
            binary_path
        );
    } else if let Ok(meta) = fs::metadata(&binary_path) {
        #[cfg(unix)]
        {
            let mut perms = meta.permissions();
            let mode = perms.mode();
            if mode & 0o111 == 0 {
                perms.set_mode(mode | 0o755);
                let _ = fs::set_permissions(&binary_path, perms);
            }
        }
    }

    // Map DJ software to menu position in Unbox TUI
    let menu_index: usize = match software.as_str() {
        "rekordbox" => 0,
        "serato" => 1,
        "traktor" => 2,
        "virtualdj" => 3,
        "mixxx" => 4,
        "djuced" => 5,
        "djay" => 6,
        "denon" => 7,
        _ => 0,
    };

    let port_in_use = tokio::net::TcpStream::connect("127.0.0.1:8080")
        .await
        .is_ok();
    if port_in_use {
        println!("[TrackCast] Port 8080 already in use — stopping listener PID(s)");
        kill_listener_on_port_8080().await;
    }

    // Start Unbox and auto-select the configured software entry.
    // macOS uses `expect` to allocate a PTY for the TUI.
    // Windows uses hidden process start + synthetic stdin keys.
    launch_unbox(binary_path, menu_index).await;
}

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
fn unbox_binary_name() -> &'static str {
    "unbox-aarch64-apple-darwin"
}

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
fn unbox_binary_name() -> &'static str {
    "unbox-x86_64-apple-darwin"
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn unbox_binary_name() -> &'static str {
    "unbox-x86_64-pc-windows-msvc.exe"
}

#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
fn unbox_binary_name() -> &'static str {
    "unbox-aarch64-pc-windows-msvc.exe"
}

#[cfg(not(any(
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "aarch64")
)))]
fn unbox_binary_name() -> &'static str {
    "unbox"
}

fn resolve_unbox_binary_path(app_handle: &tauri::AppHandle, binary_name: &str) -> PathBuf {
    if cfg!(debug_assertions) {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(binary_name);
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join(binary_name));
        candidates.push(resource_dir.join("binaries").join(binary_name));
        candidates.push(
            resource_dir
                .join("resources")
                .join("binaries")
                .join(binary_name),
        );
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join(binary_name));
            candidates.push(exe_dir.join("resources").join(binary_name));
            candidates.push(exe_dir.join("resources").join("binaries").join(binary_name));
            candidates.push(exe_dir.join("../Resources").join(binary_name));
            candidates.push(
                exe_dir
                    .join("../Resources")
                    .join("binaries")
                    .join(binary_name),
            );
            candidates.push(
                exe_dir
                    .join("../Resources")
                    .join("resources")
                    .join("binaries")
                    .join(binary_name),
            );
        }
    }

    candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from(binary_name))
}

async fn kill_listener_on_port_8080() {
    #[cfg(windows)]
    {
        if let Ok(out) = tokio::process::Command::new("cmd")
            .args(["/C", "netstat -ano -p tcp"])
            .output()
            .await
        {
            let txt = String::from_utf8_lossy(&out.stdout);
            let mut pids: Vec<String> = txt
                .lines()
                .filter(|line| line.contains(":8080") && line.contains("LISTENING"))
                .filter_map(|line| line.split_whitespace().last().map(|pid| pid.to_string()))
                .filter(|pid| !pid.is_empty())
                .collect();
            pids.sort();
            pids.dedup();

            for pid in pids {
                let _ = tokio::process::Command::new("taskkill")
                    .args(["/PID", &pid, "/T", "/F"])
                    .output()
                    .await;
            }
        }
        sleep(Duration::from_millis(500)).await;
        return;
    }

    #[cfg(unix)]
    {
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
                for pid in &pids {
                    let _ = tokio::process::Command::new("kill")
                        .arg("-TERM")
                        .arg(pid)
                        .output()
                        .await;
                }
                sleep(Duration::from_millis(700)).await;
                let still_in_use = tokio::net::TcpStream::connect("127.0.0.1:8080")
                    .await
                    .is_ok();
                if still_in_use {
                    for pid in &pids {
                        let _ = tokio::process::Command::new("kill")
                            .arg("-KILL")
                            .arg(pid)
                            .output()
                            .await;
                    }
                }
            }
            Err(e) => {
                println!(
                    "[TrackCast][kill] Failed to query PID on :8080 via lsof: {}",
                    e
                );
            }
        }
    }
}

async fn launch_unbox(binary_path: PathBuf, menu_index: usize) {
    #[cfg(target_os = "macos")]
    {
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
        script.push_str(
            "      timeout { puts stderr {[TrackCast][expect] monitoring start not confirmed} }\n",
        );
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
                println!(
                    "[TrackCast] Unbox launched in background via expect (software index: {})",
                    menu_index
                );
            }
            Err(e) => {
                println!("[TrackCast] Failed to launch Unbox via expect: {}", e);
            }
        }
        return;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let mut cmd = tokio::process::Command::new(&binary_path);
        #[cfg(windows)]
        {
            // CREATE_NEW_CONSOLE: Unbox is a TUI; giving it a console makes the
            // mode selection reliable on Windows.
            cmd.creation_flags(0x0000_0010);
        }
        #[cfg(windows)]
        let child = cmd.spawn();
        #[cfg(not(windows))]
        let child = cmd
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();

        match child {
            Ok(mut child) => {
                #[cfg(not(windows))]
                {
                if let Some(mut stdin) = child.stdin.take() {
                    sleep(Duration::from_millis(300)).await;
                    for _ in 0..menu_index {
                        let _ = stdin.write_all(b"\x1b[B").await;
                        sleep(Duration::from_millis(120)).await;
                    }
                    let _ = stdin.write_all(b"\r").await;
                    let _ = stdin.flush().await;
                }
                }
                #[cfg(windows)]
                {
                    println!(
                        "[TrackCast] Unbox launched in a console. Select software index {} manually if needed.",
                        menu_index
                    );
                }
                println!(
                    "[TrackCast] Unbox launched in background (software index: {})",
                    menu_index
                );
            }
            Err(e) => {
                println!("[TrackCast] Failed to launch Unbox: {}", e);
            }
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
                println!("[TrackCast][ws] text received");
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
        println!("[TrackCast][track] skip empty");
        return;
    }

    let mut s = state.lock().await;

    let is_duplicate_current = s
        .current_track
        .as_ref()
        .map(|current| track.is_same_as(current))
        .unwrap_or(false);

    // Receiver/UI is independent from broadcast mode:
    // update now playing whenever input track really changes.
    if !is_duplicate_current {
        s.current_track = Some(track.clone());
        let _ = app_handle.emit("track-changed", &track);
        println!("[TrackCast][track] emitted track-changed");
    } else {
        println!("[TrackCast][track] duplicate current (ui unchanged)");
    }

    // If not tracking, nothing more to do
    if !s.is_tracking {
        println!("[TrackCast][track] receiver-only mode (broadcast off)");
        return;
    }

    // Broadcast start gating (logging/Telegram only):
    // if we started while a track was already loaded, ignore same-track events
    // until the first real track change.
    if s.awaiting_first_live_change {
        if let Some(ref baseline) = s.start_baseline_track {
            if track.is_same_as(baseline) {
                println!("[TrackCast][track] waiting first live change (same baseline)");
                return;
            }
            s.awaiting_first_live_change = false;
            s.start_baseline_track = None;
            println!("[TrackCast][track] first live change detected");
        } else {
            s.start_baseline_track = Some(track.clone());
            println!("[TrackCast][track] baseline captured at start");
            return;
        }
    }

    // Keep broadcast set/telegram duplicate-safe too.
    if is_duplicate_current {
        println!("[TrackCast][track] skip duplicate in broadcast");
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
        println!("[TrackCast][track] appended set count={}", set.tracks.len());
    }

    // Send to Telegram with the immutable session snapshot (if available)
    let runtime_config = s.session_config.clone().unwrap_or_else(|| s.config.clone());
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
    let title = track.title.as_deref().unwrap_or("Unknown Track");
    let bpm = track.bpm.map(|b| format!("{:.0}", b)).unwrap_or_default();
    let key = track.key.as_deref().unwrap_or("");

    let mut msg = config
        .message_template
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
