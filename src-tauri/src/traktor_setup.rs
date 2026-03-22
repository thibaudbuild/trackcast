use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

const HELPER_DIR_NAME: &str = "traktor-d2";
const HELPER_MAIN_FILE: &str = "D2.qml";
const HELPER_VERSION: &str = "unbox-d2-v1";
const VERSION_MARKER_FILE: &str = ".trackcast_traktor_helper_version";

#[derive(Debug, Clone, Serialize)]
pub struct TraktorSetupStatus {
    pub plugin_files_present: bool,
    pub runtime_api_reachable: bool,
    pub overall_ready: bool,
    pub expected_version: String,
    pub installed_version: Option<String>,
    pub version_match: bool,
}

fn traktor_app_path() -> PathBuf {
    PathBuf::from("/Applications/Native Instruments/Traktor Pro 3/Traktor.app")
}

fn traktor_csi_dir() -> PathBuf {
    traktor_app_path().join("Contents/Resources/qml/CSI")
}

fn installed_helper_dir() -> PathBuf {
    traktor_csi_dir().join(HELPER_DIR_NAME)
}

fn installed_helper_file() -> PathBuf {
    installed_helper_dir().join(HELPER_MAIN_FILE)
}

fn installed_version_file() -> PathBuf {
    installed_helper_dir().join(VERSION_MARKER_FILE)
}

fn read_installed_version() -> Option<String> {
    let path = installed_version_file();
    let raw = fs::read_to_string(path).ok()?;
    let v = raw.trim();
    if v.is_empty() {
        None
    } else {
        Some(v.to_string())
    }
}

async fn runtime_api_reachable() -> bool {
    matches!(
        timeout(Duration::from_millis(700), TcpStream::connect("127.0.0.1:8081")).await,
        Ok(Ok(_))
    )
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err(format!("Source folder missing: {}", src.display()));
    }
    fs::create_dir_all(dst).map_err(|e| format!("Cannot create {}: {}", dst.display(), e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("Cannot read {}: {}", src.display(), e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if file_type.is_file() {
            fs::copy(&from, &to)
                .map_err(|e| format!("Copy failed {} -> {}: {}", from.display(), to.display(), e))?;
        }
    }

    Ok(())
}

fn resolve_bundle_helper_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if cfg!(debug_assertions) {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join(HELPER_DIR_NAME),
        );
    }

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join(HELPER_DIR_NAME));
        candidates.push(resource_dir.join("resources").join(HELPER_DIR_NAME));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("../Resources").join(HELPER_DIR_NAME));
            candidates.push(exe_dir.join("../Resources/resources").join(HELPER_DIR_NAME));
        }
    }

    for candidate in candidates {
        if candidate.join(HELPER_MAIN_FILE).exists() {
            return Ok(candidate);
        }
    }

    Err("Bundled Traktor helper not found in app resources.".to_string())
}

pub async fn get_traktor_setup_status() -> TraktorSetupStatus {
    let plugin_files_present = installed_helper_file().exists();
    let installed_version = read_installed_version();
    let version_match = installed_version
        .as_deref()
        .is_some_and(|v| v == HELPER_VERSION);
    let runtime_api_reachable = runtime_api_reachable().await;

    TraktorSetupStatus {
        plugin_files_present,
        runtime_api_reachable,
        overall_ready: plugin_files_present && runtime_api_reachable,
        expected_version: HELPER_VERSION.to_string(),
        installed_version,
        version_match,
    }
}

pub async fn verify_traktor_runtime() -> Result<TraktorSetupStatus, String> {
    let status = get_traktor_setup_status().await;
    println!(
        "[TrackCast][traktor-setup] verify plugin_files_present={} runtime_api_reachable={} overall_ready={}",
        status.plugin_files_present, status.runtime_api_reachable, status.overall_ready
    );

    if !status.plugin_files_present {
        return Err("Traktor setup incomplete — install helper + verify".to_string());
    }
    if !status.runtime_api_reachable {
        return Err(
            "Traktor API not reachable. Open Traktor > Controller Manager > select D2 > retry Verify."
                .to_string(),
        );
    }

    Ok(status)
}

pub fn open_traktor_csi_folder() -> Result<String, String> {
    let csi = traktor_csi_dir();
    if !csi.exists() {
        return Err(format!(
            "Traktor CSI folder not found: {}",
            csi.display()
        ));
    }

    println!("[TrackCast][traktor-setup] opening folder {}", csi.display());
    Command::new("open")
        .arg(&csi)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok("Opened Traktor CSI folder".to_string())
}

pub fn install_traktor_helper(app_handle: &tauri::AppHandle) -> Result<String, String> {
    let app_path = traktor_app_path();
    if !app_path.exists() {
        return Err(format!(
            "Traktor Pro 3 app not found at {}",
            app_path.display()
        ));
    }

    let source_dir = resolve_bundle_helper_dir(app_handle)?;
    let target_csi = traktor_csi_dir();
    let target_helper = installed_helper_dir();

    println!(
        "[TrackCast][traktor-setup] install source={} target={}",
        source_dir.display(),
        target_helper.display()
    );

    fs::create_dir_all(&target_csi).map_err(|e| {
        format!(
            "Cannot create Traktor CSI folder (permission issue?): {}",
            e
        )
    })?;

    if target_helper.exists() {
        fs::remove_dir_all(&target_helper)
            .map_err(|e| format!("Cannot replace existing helper folder: {}", e))?;
    }

    copy_dir_recursive(&source_dir, &target_helper)?;

    fs::write(installed_version_file(), HELPER_VERSION)
        .map_err(|e| format!("Helper installed but version marker failed: {}", e))?;

    Ok("Traktor helper installed. Open Traktor, select D2 in Controller Manager, then click Verify.".to_string())
}

pub async fn ensure_traktor_ready_or_err() -> Result<(), String> {
    let status = get_traktor_setup_status().await;
    println!(
        "[TrackCast][traktor-setup] preflight plugin_files_present={} runtime_api_reachable={} overall_ready={}",
        status.plugin_files_present, status.runtime_api_reachable, status.overall_ready
    );

    if status.overall_ready {
        return Ok(());
    }

    if !status.plugin_files_present {
        return Err("Traktor setup incomplete — install helper + verify".to_string());
    }

    Err("Traktor setup incomplete — API offline. Verify after selecting D2 in Traktor Controller Manager.".to_string())
}
