pub mod ty;

use reqwest::{
    Client,
    header::{HeaderMap, HeaderValue},
};
use serde_json::Value;
use ty::{Environment, User};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let token = dotenv::var("TOKEN")?;

    let mut headers = HeaderMap::new();
    headers.append("Content-Type", HeaderValue::from_static("application/json"));
    headers.append("Accept", HeaderValue::from_static("application/json"));
    headers.append("User-Agent", HeaderValue::from_static("haru/6res"));
    headers.append(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {token}"))?,
    );
    let cl = Client::builder().default_headers(headers).build()?;
    // get server state
    let z: Environment = cl
        .get("https://tetr.io/api/server/environment")
        .send()
        .await?
        .json()
        .await?;
    dbg!(&z);

    // get user data
    let u: Value = cl
        .get("https://tetr.io/api/users/me")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .send()
        .await?
        .json()
        .await?;

    dbg!(&u);

    Ok(())
}
