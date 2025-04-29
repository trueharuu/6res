pub mod json;
pub mod ty;

use anyhow::bail;
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
    headers.append("User-Agent", HeaderValue::from_static("haru/lfbot"));
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
        .send()
        .await?
        .json()
        .await?;

    if query!(u.user.role, as_str) != "bot" {
        bail!("this is not a bot account!");
    }

    let w: Value = cl
        .get("https://tetr.io/api/server/ribbon")
        .send()
        .await?
        .json()
        .await?;

    dbg!(&w);

    let endpoint = query!(w.endpoint, as_str);

    let mut ws = websocket::ClientBuilder::new(&format!("https://tetr.io{endpoint}"))
        .unwrap()
        .connect(None)
        .unwrap();

    for z in ws.incoming_messages() {
        dbg!(z?);
    }
    
    Ok(())
}
