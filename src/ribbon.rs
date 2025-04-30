use std::{
    net::{TcpListener, TcpStream},
    time::{Duration, Instant},
};

use anyhow::anyhow;
use async_recursion::async_recursion;
use async_tungstenite::tungstenite::{http::Uri, stream::MaybeTlsStream, Message, Utf8Bytes, WebSocket};
use reqwest::Client;
use serde_json::Value;
use url::Url;

use crate::{
    query,
    ty::{Handling, Packet, Signature},
};

pub struct Ribbon {
    pub rq: Client,
    pub endpoint: String,
    pub token: String,
    pub ws: Option<WebSocket<MaybeTlsStream<TcpStream>>>,
    pub session: Option<Session>,
    pub signature: Signature,
}

pub struct Session {
    pub ribbonid: String,
    pub tokenid: String,
}

impl Ribbon {
    pub fn new(token: String, endpoint: String, signature: Signature, rq: Client) -> Self {
        Self {
            rq,
            endpoint: endpoint.clone(),
            token,
            ws: None,
            session: None,
            signature,
        }
    }
    pub fn send(&mut self, msg: Packet) -> anyhow::Result<()> {
        if !matches!(msg, Packet::Ping { .. }) {
            println!("\x1b[1;32mSEND\x1b[0m {msg:?}");
        }
        let z = serde_json::to_string(&msg)?;
        // dbg!(&z);
        self.ws
            .as_mut()
            .unwrap()
            .send(Message::Text(Utf8Bytes::from(z)))?;
        Ok(())
    }

    #[async_recursion]
    pub async fn recv(&mut self, value: Packet) -> anyhow::Result<()> {
        if !matches!(value, Packet::Ping { .. }) {
            println!("\x1b[1;36mRECV\x1b[0m {value:?}");
        }
        match value {
            Packet::Packets { packets } => {
                for packet in packets {
                    self.recv(packet).await?;
                }
            }

            Packet::Session { ribbonid, tokenid } => {
                self.session = Some(Session { ribbonid, tokenid });
                self.send(Packet::ServerAuthorize {
                    handling: Some(Handling::default()),
                    signature: Some(self.signature.clone()),
                    token: Some(self.token.clone()),
                })?;
            }

            Packet::ServerAuthorize { .. } => {
                self.send(Packet::Ping { recvid: None })?;
                self.send(Packet::SocialPresence(
                    serde_json::json!({"status":"online", "detail": "menus"}),
                ))?;
            }

            Packet::Ping { .. } => {
                // todo: respond to pings, asynchronously
            }

            Packet::SocialNotification(z) => {
                if query!(z.type, as_str) == "friend" {
                    // println!("i got added!");
                    let fr = query!(z.data.relationship.from._id, as_str);
                    println!("{fr}");
                    self.rq
                        .post("https://tetr.io/api/relationships/friend")
                        .body(serde_json::json!({"user":fr}).to_string())
                        .send()
                        .await?;
                }
            }

            Packet::SocialInvite {
                roomid,
                ..
            } => {
                println!("got invited to {roomid}");
                // todo: join
                self.send(Packet::RoomJoin(roomid))?;
            }

            Packet::ServerMigrate { endpoint, .. } => {
                self.endpoint = endpoint;
                self.ws.as_mut().unwrap().close(None)?;
                self.ws = None;
                self.spin().await?;
            }
            _ => {}
        }

        Ok(())
    }
    pub async fn spin(&mut self) -> anyhow::Result<()> {
        // println!("{}", self.endpoint);
        let url = Uri::builder()
            .scheme("wss")
            .authority("tetr.io")
            .path_and_query(self.endpoint.clone())
            .build()?;
        
        // let socket = <do something with `uri` that makes an async ws>
        // self.ws = Some(socket);
        self.send(Packet::New)?;
        

        Ok(())
    }
}
