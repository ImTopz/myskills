mod commands;
mod data;
mod models;
mod services;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_store_skills,
            commands::sync_repositories,
            commands::force_sync_repositories,
            commands::get_cached_skills,
            commands::list_installed_skills,
            commands::is_skill_installed,
            commands::install_skill,
            commands::uninstall_skill,
            commands::get_skills_directory,
            commands::get_skill_content,
            commands::list_repositories,
            commands::add_repository,
            commands::remove_repository,
            commands::create_custom_skill,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
