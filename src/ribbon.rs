use std::sync::{Arc, Mutex};

use futures::SinkExt;
use tokio::net::TcpStream;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, tungstenite::http::Uri};

use crate::ty::Packet;

pub struct Ribbon {
    pub endpoint: String,
}

pub type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

impl Ribbon {
    pub fn uri(&self) -> Uri {
        Uri::builder()
            .scheme("wss")
            .authority("tetr.io")
            .path_and_query(self.endpoint.clone())
            .build()
            .unwrap()
    }

    pub async fn send(this: Arc<Self>, ws: &mut Ws, packet: Packet) {
        tracing::info!("\x1b[1;32m--->\x1b[0m {packet:?}");
        // do something..
    }

    // this can call `::send`.
    pub async fn recv(this: Arc<Self>, ws: &mut Ws, packet: Packet) {
        tracing::info!("\x1b[1;34m<---\x1b[0m {packet:?}");
        // do something..
    }
}
