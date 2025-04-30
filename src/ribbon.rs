use std::{
    net::{TcpListener, TcpStream},
    time::{Duration, Instant},
};

use anyhow::anyhow;
use async_recursion::async_recursion;
use serde_json::Value;
use tungstenite::{
    Message, Utf8Bytes, WebSocket, accept, connect, http::Uri, stream::MaybeTlsStream,
};
use url::Url;

use crate::ty::{Handling, Packet, Signature};

pub struct Ribbon {
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
    pub fn new(token: String, endpoint: String, signature: Signature) -> Self {
        Self {
            endpoint: endpoint.clone(),
            token,
            ws: None,
            session: None,
            signature,
        }
    }
    pub fn send(&mut self, msg: Packet) -> anyhow::Result<()> {
        println!("\x1b[1;32mSEND\x1b[0m {msg:?}");
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
        println!("\x1b[1;36mRECV\x1b[0m {value:?}");
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

            Packet::Ping { recvid } => {
                tokio::time::sleep(Duration::from_secs(5)).await;
                self.send(Packet::Ping { recvid: None })?;
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
        let (socket, _) = connect(url)?;

        self.ws = Some(socket);
        self.send(Packet::New)?;
        loop {
            let msg = self.ws.as_mut().ok_or(anyhow!("unreachable"))?.read()?;

            if msg.is_close() {
                println!("\x1b[1;31mEXIT\x1b[0m");
                break;
            }

            let packet: Value = serde_json::from_str(msg.into_text()?.as_str())?;

            match serde_json::from_value(packet.clone()) {
                Ok(t) => {
                    self.recv(t).await?;
                }
                Err(e) => println!(
                    "\x1b[1;31mFAIL\x1b[0m failed to parse: {}, {e}",
                    serde_json::to_string_pretty(&packet)?
                ),
            }
        }

        Ok(())
    }
}
