use serde_json::json;

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
