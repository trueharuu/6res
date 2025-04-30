use std::net::{TcpListener, TcpStream};

use tungstenite::{accept, connect, http::Uri, stream::MaybeTlsStream, Message, Utf8Bytes, WebSocket};
use url::Url;

use crate::ty::{Signature, Handling, Packet};

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
        self.ws
            .as_mut()
            .unwrap()
            .send(Message::Text(Utf8Bytes::from(serde_json::to_string(&msg)?)))?;
        Ok(())
    }

    pub fn recv(&mut self, value: Packet) -> anyhow::Result<()> {
        println!("\x1b[1;36mRECV\x1b[0m {value:?}");
        match value {
            Packet::Packets { packets } => {
                for packet in packets {
                    self.recv(packet)?;
                }
            }

            Packet::Session { ribbonid, tokenid } => {
                self.session = Some(Session { ribbonid, tokenid });
                self.send(Packet::ServerAuthorize {
                    handling: Handling::default(),
                    signature: self.signature.clone(),
                    token: self.token.clone(),
                })?;
            }
            _ => {}
        }

        Ok(())
    }
    pub fn spin(&mut self) -> anyhow::Result<()> {
        // println!("{}", self.endpoint);
        let url = Uri::builder().scheme("wss").authority("tetr.io").path_and_query(self.endpoint.clone()).build()?;
        let (socket, _) = connect(url)?;

        self.ws = Some(socket);
        self.send(Packet::New)?;
        loop {
            let msg = self.ws.as_mut().unwrap().read().unwrap();

            if msg.is_close() {
                println!("\x1b[1;31mEXIT\x1b[0m");
                break;
            }

            let packet = serde_json::from_str(msg.into_text().unwrap().as_str()).unwrap();
            self.recv(packet)?;
        }

        Ok(())
    }
}
