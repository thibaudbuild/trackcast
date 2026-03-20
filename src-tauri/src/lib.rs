mod unbox;
mod telegram;
mod history;
mod state;

use state::AppState;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;

#[tauri::command]
async fn start_tracking(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let (
        already_tracking,
        should_start_listener,
        dj_software,
        current_track_snapshot,
        session_config_snapshot,
    ) = {
        let mut s = state.lock().await;
        let already_tracking = s.is_tracking;
        if already_tracking {
            (
                already_tracking,
                false,
                String::new(),
                None,
                s.config.clone(),
            )
        } else {
            let snapshot = s.config.clone();
            if snapshot.dj_software.trim().is_empty() {
                return Err("DJ software is not configured".to_string());
            }
            s.is_tracking = true;
            s.current_set = Some(history::DjSet::new());
            s.session_config = Some(snapshot.clone());
            let should_start_listener = !s.unbox_listener_started;
            if should_start_listener {
                s.unbox_listener_started = true;
            }
            (
                already_tracking,
                should_start_listener,
                snapshot.dj_software.clone(),
                s.current_track.clone(),
                snapshot,
            )
        }
    };
    if already_tracking {
        return Ok("Already tracking".to_string());
    }

    // Always relaunch Unbox at Start to guarantee the selected software is applied.
    unbox::restart_unbox_for_software(dj_software).await;

    // Launch Unbox + WebSocket listener only once for app lifetime.
    // (prevents duplicate listeners across multiple Start/Stop cycles)
    if should_start_listener {
        let state_clone = Arc::clone(&state);
        let app_handle_listener = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            unbox::run_unbox_listener(app_handle_listener, state_clone).await;
        });
    }

    // If retry/prewarm already fetched a current track before Start,
    // register it immediately in the set and send Telegram once at start.
    if let Some(track) = current_track_snapshot {
        if !track.is_empty() {
            {
                let mut s = state.lock().await;
                if let Some(ref mut set) = s.current_set {
                    set.tracks.push(history::HistoryEntry {
                        time: chrono::Local::now().format("%H:%M").to_string(),
                        artist: track.artist.clone().unwrap_or_default(),
                        title: track.title.clone().unwrap_or_default(),
                        bpm: track.bpm,
                        key: track.key.clone(),
                    });
                }
            }

            let token = session_config_snapshot.telegram_token.clone();
            let chat_id = session_config_snapshot.telegram_chat_id.clone();
            if !token.is_empty() && !chat_id.is_empty() {
                let message = unbox::build_message(&track, &session_config_snapshot);
                let app_handle_clone = app_handle.clone();
                let display = track.display_name();
                tauri::async_runtime::spawn(async move {
                    match telegram::send_message(&token, &chat_id, &message).await {
                        Ok(_) => {
                            let _ = app_handle_clone.emit("telegram-sent", &display);
                        }
                        Err(e) => {
                            let _ = app_handle_clone.emit("telegram-error", &e.to_string());
                        }
                    }
                });
            }
        }
    }

    // Auto-save every 2 minutes (crash protection)
    let state_autosave = Arc::clone(&state);
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(120)).await;
            let s = state_autosave.lock().await;
            if !s.is_tracking {
                break;
            }
            if let Some(ref set) = s.current_set {
                if !set.tracks.is_empty() {
                    let _ = history::save_set(set);
                }
            }
        }
    });

    Ok("Tracking started".to_string())
}

#[tauri::command]
async fn stop_tracking(state: tauri::State<'_, Arc<Mutex<AppState>>>) -> Result<String, String> {
    let mut s = state.lock().await;
    s.is_tracking = false;
    s.session_config = None;

    // Stamp end time and save
    if let Some(ref mut set) = s.current_set {
        set.end_time = Some(chrono::Local::now().format("%H:%M").to_string());
        if let Err(e) = history::save_set(set) {
            return Err(format!("Failed to save set: {}", e));
        }
    }

    Ok("Tracking stopped".to_string())
}

#[tauri::command]
async fn get_set_history() -> Result<Vec<history::SetSummary>, String> {
    Ok(history::load_set_history())
}

#[tauri::command]
async fn export_set_by_filename(filename: String) -> Result<String, String> {
    history::export_set_by_filename(&filename)
}

#[tauri::command]
async fn get_current_track(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<Option<unbox::TrackInfo>, String> {
    let s = state.lock().await;
    Ok(s.current_track.clone())
}

#[tauri::command]
async fn get_track_history(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<history::HistoryEntry>, String> {
    let s = state.lock().await;
    match &s.current_set {
        Some(set) => Ok(set.tracks.clone()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
async fn save_config(
    config: state::UserConfig,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let mut s = state.lock().await;
    if s.is_tracking {
        return Err("Settings are locked while broadcasting".to_string());
    }
    s.config = config.clone();
    state::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_config(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<state::UserConfig, String> {
    let s = state.lock().await;
    Ok(s.config.clone())
}

#[tauri::command]
async fn verify_token(token: String) -> Result<String, String> {
    telegram::verify_token(&token)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
async fn test_telegram(
    token: String,
    chat_id: String,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    {
        let s = state.lock().await;
        if s.is_tracking {
            return Err("Settings are locked while broadcasting".to_string());
        }
    }
    telegram::send_message(&token, &chat_id, "🎛 TrackCast connected! Ready to broadcast your set.")
        .await
        .map(|_| "Message sent!".to_string())
        .map_err(|e| format!("Failed: {}", e))
}

#[tauri::command]
async fn export_set(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let s = state.lock().await;
    match &s.current_set {
        Some(set) => Ok(history::export_set_txt(set)),
        None => Err("No active set".to_string()),
    }
}

#[tauri::command]
async fn get_unbox_status(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<bool, String> {
    let s = state.lock().await;
    Ok(s.unbox_connected)
}

#[tauri::command]
async fn retry_connection(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let (software, should_start_listener) = {
        let mut s = state.lock().await;
        let software = s
            .session_config
            .as_ref()
            .map(|cfg| cfg.dj_software.clone())
            .unwrap_or_else(|| s.config.dj_software.clone());
        let should_start_listener = !s.unbox_listener_started;
        if should_start_listener {
            s.unbox_listener_started = true;
        }
        (software, should_start_listener)
    };
    if software.trim().is_empty() {
        return Err("DJ software is not configured".to_string());
    }

    let _ = app_handle.emit("unbox-status", false);
    unbox::restart_unbox_for_software(software).await;

    if should_start_listener {
        let state_clone = Arc::clone(&state);
        let app_handle_clone = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            unbox::run_unbox_listener(app_handle_clone, state_clone).await;
        });
    }

    Ok("Connection retry launched".to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Load config
            let config = state::load_config().unwrap_or_default();

            let app_state = Arc::new(Mutex::new(AppState {
                is_tracking: false,
                current_track: None,
                current_set: None,
                unbox_connected: false,
                unbox_listener_started: false,
                session_config: None,
                config,
            }));

            app.manage(app_state.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_tracking,
            stop_tracking,
            get_current_track,
            get_track_history,
            save_config,
            get_config,
            verify_token,
            test_telegram,
            export_set,
            get_unbox_status,
            retry_connection,
            get_set_history,
            export_set_by_filename,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TrackCast");
}
