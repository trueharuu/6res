use std::sync::Arc;

use async_recursion::async_recursion;
use futures::{SinkExt, stream::SplitSink};
use tokio::{net::TcpStream, sync::Mutex};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream,
    tungstenite::{Message, http::Uri},
};

use crate::ty::{Handling, Packet, Signature};

pub struct Ribbon {
    pub endpoint: String,
    pub session: Option<Session>,
    pub signature: Signature,
    pub token: String,
}

pub struct Session {
    pub ribbonid: String,
    pub tokenid: String,
}

pub type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;
pub type Tx = SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>;
impl Ribbon {
    pub fn uri(&self) -> Uri {
        Uri::builder()
            .scheme("wss")
            .authority("tetr.io")
            .path_and_query(self.endpoint.clone())
            .build()
            .unwrap()
    }

    pub async fn send(_: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, packet: Packet) {
        tracing::info!("\x1b[1;32m===>\x1b[0m {packet:?}");
        tx.lock()
            .await
            .send(Message::Text(
                serde_json::to_string(&packet).unwrap().into(),
            ))
            .await
            .unwrap();
        // do something..
    }

    // this can call `::send`.
    #[async_recursion]
    pub async fn recv(this: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, packet: Packet) {
        tracing::info!("\x1b[1;34m<===\x1b[0m {packet:?}");
        match packet {
            Packet::Packets { packets } => {
                for p in packets {
                    let z = this.clone();
                    let t = tx.clone();
                    tokio::spawn(async move {
                        Self::recv(z, t, p).await;
                    });
                }
            }

            Packet::Session { ribbonid, tokenid } => {
                this.lock().await.session = Some(Session { ribbonid, tokenid });
                let z = this.clone();
                let t = tx.clone();
                let sig = z.lock().await.signature.clone();
                let token = z.lock().await.token.clone();
                // dbg!(&sig, &token);
                Ribbon::send(
                    z,
                    t,
                    Packet::ServerAuthorize {
                        handling: Some(Handling::default()),
                        signature: Some(sig),
                        token: Some(token),
                    },
                )
                .await;
            }
            _ => {}
        }
        // do something..
    }
}
