use std::sync::Arc;

use async_recursion::async_recursion;
use futures::{SinkExt, stream::SplitSink};
use tokio::{net::TcpStream, sync::Mutex};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream,
    tungstenite::{Message as Msg, http::Uri},
};

use crate::ty::{
    ClientAuthorize, ClientSocialDm, Either, Handling, Message, Packet, Session, Signature, User,
};

pub struct Ribbon {
    pub endpoint: String,
    pub session: Option<Session>,
    pub signature: Signature,
    pub token: String,
    pub user: User,
    pub migrating: bool,
    // pub recvid: u64,
    // pub attach_ids: bool,
}

pub type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;
pub type Tx =
    SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, tokio_tungstenite::tungstenite::Message>;
impl Ribbon {
    pub fn uri(&self) -> Uri {
        Uri::builder()
            .scheme("wss")
            .authority("tetr.io")
            .path_and_query(self.endpoint.clone())
            .build()
            .unwrap()
    }

    pub async fn send(_: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, msg: Message) {
        // if !matches!(msg.packet, Packet::Ping { .. }) {
        tracing::info!("\x1b[1;32m===>\x1b[0m {msg:?}");
        // }

        tx.lock()
            .await
            .send(Msg::Text(serde_json::to_string(&msg).unwrap().into()))
            .await
            .unwrap();
        // do something..
    }

    pub async fn send_packet(t: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, msg: Packet) {
        let msg = Message {
            id: None, // todo: actually sync
            packet: msg,
        };
        Ribbon::send(t, tx, msg).await;
    }

    // this can call `::send`.
    #[async_recursion]
    pub async fn recv(this: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, msg: Message, is_pckts: bool) {
        // if !matches!(msg.packet, Packet::Ping { .. } | Packet::Packets { .. }) {
        tracing::info!(
            "\x1b[1;34m{}\x1b[0m {msg:?}",
            if is_pckts { "<---" } else { "<===" }
        );
        // }
        match msg.packet {
            Packet::Packets { packets } => {
                for p in packets {
                    let z = this.clone();
                    let t = tx.clone();

                    tokio::spawn(async move {
                        Self::recv(z, t, p, true).await;
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
                Ribbon::send_packet(
                    z,
                    t,
                    Packet::ServerAuthorize(Either::Client(ClientAuthorize {
                        handling: Handling::default(),
                        signature: sig,
                        token,
                    })),
                )
                .await;
            }

            Packet::ServerAuthorize { .. } => {
                let z = this.clone();
                let t = tx.clone();
                tokio::task::spawn(async move {
                    let mut i = tokio::time::interval(tokio::time::Duration::from_secs(5));

                    loop {
                        i.tick().await;
                        Ribbon::send_packet(z.clone(), t.clone(), Packet::Ping { recvid: None })
                            .await;
                    }
                });
                Ribbon::send_packet(
                    this.clone(),
                    tx.clone(),
                    Packet::SocialPresence(serde_json::json!({"status":"away","detail":""})),
                )
                .await;
            }

            Packet::SocialDm(z) => {
                match z {
                    Either::Server(z) => {
                        if z.id == this.lock().await.user._id {
                            return;
                        }
                        println!("got a dm from ok user!");
                        Ribbon::send_packet(
                            this.clone(),
                            tx.clone(),
                            Packet::SocialDm(Either::Client(ClientSocialDm {
                                recipient: z.data.user,
                                msg: "!".to_string(),
                            })),
                        )
                        .await;
                    }
                    _ => {}
                };
            }

            Packet::SocialInvite { roomid, .. } => {
                Ribbon::send_packet(
                    this.clone(),
                    tx.clone(),
                    Packet::RoomJoin(Either::Client(roomid)),
                )
                .await;
            }
            _ => {}
        }
        // do something..
    }
}
