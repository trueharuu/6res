pub mod json;
pub mod ribbon;
pub mod ty;

use anyhow::bail;
use reqwest::{
    Client,
    header::{HeaderMap, HeaderValue},
};
use ribbon::Ribbon;
use serde_json::Value;
use ty::Environment;

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
    let rq = Client::builder().default_headers(headers).build()?;
    // get server state
    let _z: Environment = rq
        .get("https://tetr.io/api/server/environment")
        .send()
        .await?
        .json()
        .await?;

    // dbg!(&query!(_z.signature, as_object));

    // get user data
    let u: Value = rq
        .get("https://tetr.io/api/users/me")
        .send()
        .await?
        .json()
        .await?;

    dbg!(&u);

    if query!(u.user.role, as_str) != "bot" {
        bail!("this is not a bot account!");
    }

    let w: Value = rq
        .get("https://tetr.io/api/server/ribbon")
        .send()
        .await?
        .json()
        .await?;

    // dbg!(&w);

    let endpoint = query!(w.endpoint, as_str);

    let mut r = Ribbon::new(token, endpoint.to_string(), _z.signature, rq);
    r.spin().await?;

    //

    Ok(())
}
