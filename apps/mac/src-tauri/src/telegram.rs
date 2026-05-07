use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

/// Verify a bot token is valid by calling getMe
pub async fn verify_token(
    token: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("https://api.telegram.org/bot{}/getMe", token);
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await?;
    if response.status().is_success() {
        let body: serde_json::Value = response.json().await?;
        let name = body["result"]["username"]
            .as_str()
            .unwrap_or("bot")
            .to_string();
        Ok(name)
    } else {
        Err("Invalid token".into())
    }
}

/// Send a message to a Telegram chat via Bot API
pub async fn send_message(
    token: &str,
    chat_id: &str,
    text: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("https://api.telegram.org/bot{}/sendMessage", token);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&json!({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML"
        }))
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let body = response.text().await.unwrap_or_default();
        Err(format!("Telegram API error: {}", body).into())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedChannel {
    pub chat_id: String,
    pub title: String,
    pub chat_type: String,
}

/// Fetch recent updates from the bot and extract unique channels/groups
pub async fn get_updates(
    token: &str,
) -> Result<Vec<DetectedChannel>, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("https://api.telegram.org/bot{}/getUpdates", token);
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await?;
    if !response.status().is_success() {
        return Err("Failed to fetch updates".into());
    }
    let body: serde_json::Value = response.json().await?;
    let empty = vec![];
    let results = body["result"].as_array().unwrap_or(&empty);

    let mut seen: HashMap<String, DetectedChannel> = HashMap::new();

    for update in results {
        // Check message.chat, channel_post.chat, my_chat_member.chat
        let chat_sources = [
            &update["message"]["chat"],
            &update["channel_post"]["chat"],
            &update["my_chat_member"]["chat"],
        ];
        for chat in chat_sources {
            if chat.is_null() {
                continue;
            }
            let chat_type = chat["type"].as_str().unwrap_or("");
            if !matches!(chat_type, "channel" | "group" | "supergroup") {
                continue;
            }
            let id = if let Some(n) = chat["id"].as_i64() {
                n.to_string()
            } else {
                continue;
            };
            let title = chat["title"].as_str().unwrap_or("Untitled").to_string();
            seen.entry(id.clone()).or_insert(DetectedChannel {
                chat_id: id,
                title,
                chat_type: chat_type.to_string(),
            });
        }
    }

    Ok(seen.into_values().collect())
}
