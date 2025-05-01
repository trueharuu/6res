use tokio_tungstenite::tungstenite::{Message, Utf8Bytes, http::Uri};

use crate::ty::Packet;

pub struct Ribbon {
    pub endpoint: String,
    pub token: String,
}

impl Ribbon {
    pub fn new(token: String, endpoint: String) -> Self {
        Self { token, endpoint }
    }

    pub fn uri(&self) -> Uri {
        Uri::builder()
            .scheme("wss")
            .authority("tetr.io")
            .path_and_query(self.endpoint.clone())
            .build()
            .unwrap()
    }

    /// start a websocket connection to `wss://tetr.io{self.endpoint}`
    pub async fn connect(&mut self) {}

    /// connect, then do read/write loop to the websocket. this is the main method used to start a Ribbon.
    pub async fn spin(&mut self) {
        self.send(Packet::Ping { recvid: None }).await;
    }

    /// sends a `Packet`. all calls to this should be threaded, so that anything performed as a result of a packet is non-blocking.
    pub async fn send(&mut self, packet: Packet) {
        tracing::info!("sent {packet:?}");
        let _ = Message::Text(Utf8Bytes::from(serde_json::to_string(&packet).unwrap()));
    }

    /// recieves a `Packet`, and does something of my choice with it. all calls to this should be threaded.
    /// this method should be able to call `.send()` whenever needed.
    ///
    /// UPON RECIEVING `Packet::Migrate` this should call `.migrate()`
    pub async fn recv(&mut self, packet: Packet) {
        drop(packet);
    }

    /// this should be run in the background.
    /// every 5 seconds, `.send(Packet::Ping)` should be called.
    pub async fn ping_loop(&mut self) {}

    /// - finish all outgoing messages, if any
    /// - close the connection.
    /// - assign `self.endpoint` to be the `endpoint` field contained in the packet
    /// - reconnect
    pub async fn migrate(&mut self, _: String) {}
}
