pub mod json;
pub mod ribbon;
pub mod ty;

use std::sync::Arc;

use anyhow::bail;
use futures::StreamExt;
use reqwest::{
    Client,
    header::{HeaderMap, HeaderValue},
};
use ribbon::Ribbon;
use serde_json::Value;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message as Msg;
use ty::{Environment, Message, Packet};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // println!("\x1b[2mdim\x1b[0m");
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

    let tsr = Arc::new(Mutex::new(Ribbon {
        endpoint: endpoint.clone(),
        signature: _z.signature,
        session: None,
        token: token.clone(),
        user: serde_json::from_value(u.get("user").unwrap().clone()).unwrap(),
        migrating: false,
    }));
    loop {
        let ribbon = tsr.clone();
        tokio::spawn(async move {
            // tracing::info!("{}", ribbon.lock().await.uri());
            let ws: ribbon::Ws = tokio_tungstenite::connect_async(ribbon.lock().await.uri())
                .await
                .unwrap()
                .0;

            let (tx, mut rx) = ws.split();
            let tt = Arc::new(Mutex::new(tx));

            if ribbon.lock().await.migrating {
                let session = ribbon.lock().await.session.clone().unwrap();
                Ribbon::send_packet(
                    ribbon.clone(),
                    tt.clone(),
                    Packet::Session {
                        ribbonid: session.ribbonid,
                        tokenid: session.tokenid,
                    },
                )
                .await;
                ribbon.lock().await.migrating = false;
            } else {
                Ribbon::send_packet(ribbon.clone(), tt.clone(), Packet::New).await;
            }

            loop {
                let parcel = rx.next().await; // error here
                if let Some(t) = parcel {
                    match t {
                        Ok(content) => match content {
                            Msg::Text(text) => {
                                let cpy = ribbon.clone();
                                let s: Value = serde_json::from_str(&text).unwrap();
                                // tracing::debug!("{s:#?}");
                                match serde_json::from_value::<Message>(s.clone()) {
                                    Ok(msg) => {
                                        let tx = tt.clone();

                                        if let Packet::ServerMigrate { ref endpoint, .. } =
                                            msg.packet
                                        {
                                            // - wait for all calls to `send` and `recv` to finish
                                            // - kill current connection
                                            // - reconnect to new endpoint
                                            // call this exact thread again

                                            tracing::info!(name: "res::ribbon", "\x1b[1;33m<==>\x1b[0m {endpoint}");
                                            ribbon.lock().await.endpoint = endpoint.clone();
                                            ribbon.lock().await.migrating = true;
                                            return;
                                        }

                                        tokio::spawn(async move {
                                            Ribbon::recv(cpy, tx, msg, false).await;
                                        })
                                        .await
                                        .unwrap();
                                    }
                                    Err(e) => {
                                        tracing::error!("{e}");
                                        tracing::debug!(
                                            "{}",
                                            serde_json::to_string_pretty(&s).unwrap()
                                        );
                                    }
                                }
                            }

                            Msg::Close(_) => {
                                //
                            }

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

        if !tsr.lock().await.migrating {
            break Ok(());
        }
    }
}
