use std::{fmt::Display, sync::Arc};

use async_recursion::async_recursion;
use futures::{SinkExt, stream::SplitSink};
use tokio::{net::TcpStream, sync::Mutex};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream,
    tungstenite::{Message as Msg, http::Uri},
};

use crate::ty::{
    Bracket, ClientAuthorize, ClientSocialDm, Either, Handling, Message, Packet, Room, Session,
    Signature, User,
};

pub struct Ribbon {
    pub endpoint: String,
    pub session: Option<Session>,
    pub signature: Signature,
    pub token: String,
    pub user: User,
    pub migrating: bool,
    pub recvid: u64,
    pub pl: Option<tokio::task::JoinHandle<()>>,
    pub room: Option<Room>,
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
        if !matches!(msg.packet, Packet::Ping { .. }) {
            tracing::info!("\x1b[1;32m===>\x1b[0m {msg:?}");
        } else {
            tracing::debug!("\x1b[1;32m===>\x1b[0m {msg:?}");
        }

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

    pub async fn should_ignore(this: Arc<Mutex<Self>>, msg: Message) -> bool {
        if matches!(
            msg.packet,
            Packet::Ping { .. } | Packet::Session { .. } | Packet::Packets { .. }
        ) {
            return false;
        }

        if msg.id.is_some() && msg.id.unwrap() < this.lock().await.recvid {
            return true;
        }

        return false;
    }

    // this can call `::send`.
    #[async_recursion]
    pub async fn recv(this: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, msg: Message, is_pckts: bool) {
        if !matches!(msg.packet, Packet::Ping { .. } | Packet::Packets { .. }) {
            tracing::info!(
                "\x1b[1;34m{}\x1b[0m {msg:?}",
                if is_pckts { "<---" } else { "<===" }
            );
        } else {
            tracing::debug!(
                "\x1b[1;34m{}\x1b[0m {msg:?}",
                if is_pckts { "<---" } else { "<===" }
            );
        }

        match msg.packet {
            Packet::Packets { packets } => {
                for p in packets {
                    // println!("packet had id {:?} vs. {}", p.id, this.lock().await.recvid);
                    if Ribbon::should_ignore(this.clone(), p.clone()).await {
                        return;
                    }
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
                Ribbon::start_ping_loop(z, t).await;
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
                        tracing::warn!("got a dm from ok user!");
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

            Packet::ServerMigrated {} => {
                Ribbon::start_ping_loop(this, tx).await;
            }

            Packet::RoomChat { content, user, .. } => {
                println!("{} vs {}", this.lock().await.user._id, user._id);
                if this.lock().await.user._id == user._id {
                    return;
                }
                tracing::warn!("got a chat from ok user!");

                if content == "~join" {
                    let room = this.lock().await.room.clone();
                    println!("room: {room:?}");
                    if let Some(r) = room {
                        if r.width != 4 {
                            Ribbon::send_packet(
                                this.clone(),
                                tx.clone(),
                                Packet::RoomChatSend {
                                    content: "board.width must be 4".to_string(),
                                    pinned: false,
                                },
                            )
                            .await;
                            return;
                        }

                        if r.g != 0.0 {
                            Ribbon::send_packet(
                                this.clone(),
                                tx.clone(),
                                Packet::RoomChatSend {
                                    content: "gravity must be 0".to_string(),
                                    pinned: false,
                                },
                            )
                            .await;
                            return;
                        }

                        if r.gi != 0.0 {
                            Ribbon::send_packet(
                                this.clone(),
                                tx.clone(),
                                Packet::RoomChatSend {
                                    content: "gravity increase must be 0".to_string(),
                                    pinned: false,
                                },
                            )
                            .await;
                            return;
                        }

                        Ribbon::send_packet(
                            this.clone(),
                            tx.clone(),
                            Packet::RoomBracketSwitch(Bracket::Player)
                        )
                        .await;
                    }
                }
            }

            Packet::RoomUpdate { options, .. } => {
                this.lock().await.room = Some(Room {
                    width: options.boardwidth,
                    g: options.g,
                    gi: options.gincrease,
                });
            }
            _ => {}
        }
        // do something..
    }

    pub async fn send_chat_message(this: Arc<Mutex<Self>>, tx: Arc<Mutex<Tx>>, msg: impl Display) {
        Ribbon::send_packet(
            this.clone(),
            tx.clone(),
            Packet::RoomChatSend {
                content: msg.to_string(),
                pinned: false,
            },
        )
        .await;
    }

    pub async fn start_ping_loop(z: Arc<Mutex<Self>>, t: Arc<Mutex<Tx>>) {
        tracing::warn!("starting ping loop");

        let tt = z.clone();
        z.clone().lock().await.pl = Some(tokio::task::spawn(async move {
            let mut i = tokio::time::interval(tokio::time::Duration::from_secs(5));

            loop {
                i.tick().await;
                Ribbon::send_packet(
                    tt.clone(),
                    t.clone(),
                    Packet::Ping {
                        recvid: Some(tt.lock().await.recvid),
                    },
                )
                .await;
            }
        }));
    }
}
