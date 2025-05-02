pub mod json;
pub mod ribbon;
pub mod ty;

use std::sync::{Arc, Mutex};

use anyhow::bail;
use futures::{SinkExt, StreamExt};
use reqwest::{
    Client,
    header::{HeaderMap, HeaderValue},
};
use ribbon::Ribbon;
use serde_json::Value;
use tokio_tungstenite::tungstenite::Message;
use ty::{Environment, Packet};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
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

    // dbg!(&u);

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

    let endpoint = query!(w.endpoint, as_str).to_string();

    let tsr = Arc::new(Ribbon {
        endpoint: endpoint.clone(),
    });
    tokio::spawn(async move {
        let ribbon = tsr.clone();
        tracing::info!("{}", ribbon.uri());
        let mut ws: ribbon::Ws = tokio_tungstenite::connect_async(ribbon.uri())
            .await
            .unwrap()
            .0;

        
        tracing::info!("connected to {endpoint}");

        Ribbon::send(ribbon.clone(), &mut ws, Packet::New).await;
        loop {
            let parcel = ws.next().await; // error here
            if let Some(t) = parcel {
                match t {
                    Ok(content) => match content {
                        Message::Text(text) => {
                            let cpy = ribbon.clone();
                            let packet: Packet = serde_json::from_str(&text).unwrap();
                            tokio::spawn(async move {
                                Ribbon::recv(cpy, &mut ws, packet).await;
                            }).await;
                        }

                        Message::Close(_) => {
                            tracing::error!("\x1b[1;31m----\x1b[0m");
                        },

                        c => {
                            tracing::warn!("got unknown message: {c:?}");
                        }
                    },
                    Err(e) => {
                        tracing::error!("{e}");
                    }
                }
            } else {
                tracing::error!("no more packets to receive");
                break;
            }
        }
    })
    .await?;

    Ok(())
}
