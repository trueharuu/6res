use std::fmt::Debug;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Environment {
    pub signature: Signature,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Session {
    pub ribbonid: String,
    pub tokenid: String,
}

#[derive(Clone, Serialize, Deserialize)]

pub struct Signature {
    catalog: Value,
    ch_domain: String,
    client: SigClient,
    countdown: bool,
    domain: String,
    domain_hash: String,
    league_additional_settings: Value,
    league_mm_roundtime_max: f64,
    league_mm_roundtime_min: f64,
    league_season: LeagueSeason,
    mode: String,
    noreplaydispute: bool,
    norichpresence: bool,
    novault: bool,
    sentry_enabled: bool,
    #[serde(rename = "serverCycle")]
    server_cycle: String,
    supporter_specialthanks_goal: f64,
    version: String,
    xp_multiplier: f64,
    zenith_additional_settings: Value,
    zenith_cpu_count: f64,
    zenith_duoisfree: bool,
    zenith_freemod: bool,
}

impl Debug for Signature {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.version)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LeagueSeason {
    current: String,
    next: Value,
    next_at: Value,
    prev: String,
    ranked: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SigClient {
    branch: String,
    build: SigClientVersion,
    commit: SigClientVersion,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SigClientVersion {
    id: String,
    time: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub _id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Either<T, U> {
    Server(T),
    Client(U),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "command", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum Packet {
    New,
    Packets {
        packets: Vec<Message>,
    },
    Kick {
        reason: String,
    },
    Session {
        ribbonid: String,
        tokenid: String,
    },
    #[serde(rename = "social.online")]
    SocialOnline(usize),
    #[serde(rename = "server.authorize")]
    ServerAuthorize(Either<ServerAuthorize, ClientAuthorize>),
    Ping {
        recvid: Option<u64>,
    },
    #[serde(rename = "social.presence")]
    SocialPresence(Value),
    #[serde(rename = "social.dm")]
    SocialDm(Either<ServerSocialDm, ClientSocialDm>),
    #[serde(rename = "social.notification")]
    SocialNotification(Value),
    #[serde(rename = "social.invite")]
    SocialInvite {
        roomid: String,
        roomname: String,
        roomname_safe: Option<String>,
        sender: String,
    },
    #[serde(rename = "room.join")]
    RoomJoin(Either<ServerRoomJoin, ClientRoomJoin>),
    #[serde(rename = "room.update")]
    #[serde(rename_all = "camelCase")]
    RoomUpdate {
        allow_bots: bool,
        allow_chat: bool,
        creator: String,
        id: String,
        #[serde(rename = "match")]
        zmatch: Match,
        players: Vec<User>,
        state: String,
        #[serde(rename = "type")]
        ty: String,
        options: Options,
    },
    #[serde(rename = "server.migrate")]
    ServerMigrate {
        endpoint: String,
        flag: String,
        name: String,
    },
    #[serde(rename = "social.dm.fail")]
    SocialDmFail(Value),
    #[serde(rename = "server.migrated")]
    ServerMigrated {},
    #[serde(rename = "notify")]
    Notify {
        msg: String,
        #[serde(rename = "type")]
        kind: Option<String>,
    },
    #[serde(rename = "room.chat")]
    RoomChat {
        content: String,
        pinned: bool,
        system: bool,
        user: User,
    },
    #[serde(rename = "room.update.bracket")]
    RoomUpdateBracket(Value),
    #[serde(rename = "game.ready")]
    GameReady(Value),
    #[serde(rename = "game.replay.ige")]
    GameReplayIge(Value),
    #[serde(rename = "room.update.auto")]
    RoomUpdateAuto(Value),
    #[serde(rename = "game.match")]
    GameMatch(Value),
    #[serde(rename = "game.start")]
    GameStart(Value),
    #[serde(rename = "room.bracket.switch")]
    RoomBracketSwitch(Bracket),
    #[serde(rename = "room.chat.send")]
    RoomChatSend {
        content: String,
        pinned: bool,
    },
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: Option<u64>,
    #[serde(flatten)]
    pub packet: Packet,
}

impl Debug for Message {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let id = self.id.unwrap_or(0);
        if f.alternate() {
            write!(f, "{:#?} @ {id}", self.packet)
        } else {
            write!(f, "{:?} @ {id}", self.packet)
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerSocialDm {
    pub data: Dm,
    pub id: String,
    pub stream: String,
    pub ts: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ClientSocialDm {
    pub recipient: String,
    pub msg: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ClientAuthorize {
    pub handling: Handling,
    pub signature: Signature,
    pub token: String,
}

impl Debug for ClientAuthorize {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "<...>")
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerAuthorize {
    pub maintenance: bool,
    pub worker: Value,
    // pub social: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ServerRoomJoin {
    pub banner: Option<String>,
    pub id: String,
    pub silent: bool,
}

pub type ClientRoomJoin = String;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Bracket {
    Player,
    Spectator,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SocialNotification {
    Test {
        message: String,
    },
    Announcement {
        pri: Option<String>,
        sec: Option<String>,
        img_main: Option<String>,
        img_sub: Option<String>,
        header: String,
        content: String,
        action: Option<String>,
    },

    SupporterNew,
    SupporterExpired,
    SupporterGift {
        userid: String,
        username: String,
        avatar_revision: Option<String>,
        months: usize,
    },

    SupporterSpecialthanks,
    SupporterExpiring {
        expires: String,
    },
    Friend {
        relationship: Relationship,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Relationship {
    pub ismutual: bool,
    pub from: RelationshipParty,
    pub to: RelationshipParty,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RelationshipParty {
    pub _id: String,
    pub username: String,
    pub avatar_revision: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SocialNotificationType {
    Test,
    Announcement,
    SupporterNew,
    SupporterGift,
    SupporterSpecialthanks,
    SupporterExpiring,
    SupporterExpired,
    Friend,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Dm {
    pub content: String,
    pub content_safe: Option<String>,
    pub system: Option<bool>,
    pub user: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Handling {
    pub arr: usize,
    pub das: usize,
    pub dcd: usize,
    pub sdf: usize,
    pub safelock: bool,
    pub cancel: bool,
    pub may20g: bool,
    pub ihs: Initial,
    pub irs: Initial,
}

impl Default for Handling {
    fn default() -> Self {
        Self {
            arr: 2,
            das: 10,
            dcd: 0,
            sdf: 6,
            safelock: true,
            cancel: false,
            may20g: true,
            ihs: Initial::Tap,
            irs: Initial::Tap,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
#[serde(rename_all = "snake_case")]
pub enum Initial {
    Tap,
    Hold,
    None,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Room {
    pub width: u64,
    pub g: f64,
    pub gi: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Match {
    pub ft: u64,
    pub gamemode: String,
    pub gp: u64,
    pub modename: String,
    
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Options {
    // pub allclear_b2b: u64,
    // pub allclear_b2b_dupes: bool,
    // pub allclear_b2b_sends: bool,
    // pub allclear_charges: bool,
    // pub allclear_garbage: u64,
    // pub allclears: bool,
    pub allow180: bool,
    pub allow_harddrop: bool,
    // pub are: u64,
    // pub b2bchaining: bool,
    // pub b2bcharge_at: u64,
    // pub b2bcharge_base: u64,
    // pub b2bcharging: bool,
    // pub b2bextras: bool,
    pub bagtype: String,
    // pub bgmnoreset: bool,
    pub boardheight: u64,
    pub boardwidth: u64,
    // pub can_retry: bool,
    // pub can_undo: bool,
    // pub clutch: bool,
    // pub combotable: String,
    // pub countdown: bool,
    // pub countdown_count: u64,
    // pub countdown_interval: u64,
    // pub display_fire: bool,
    pub display_hold: bool,
    pub display_next: bool,
    pub display_shadow: bool,
    pub display_username: bool,
    // pub forfeit_time: u64,
    pub g: f64,
    pub gincrease: f64,
    // pub garbageabsolutecap: u64,
    // pub garbageare: u64,
    // pub garbagearebump: u64,
    // pub garbageblocking: String,
    // pub garbagecap: u64,
    // pub garbagecapincrease: f64,
    // pub garbagecapmargin: u64,
    // pub garbagecapmax: u64,
    // pub garbageentry: String,
    // pub garbageholesize: usize,
    // pub garbageincrease: f64,
    // pub garbagemargin: u64,
    // pub garbagemultiplier: f64,
    // pub garbagephase: f64,
    // pub garbagequeue: bool,
    // pub garbagespecialbonus: bool,
    // pub infinite_movement: bool,
    pub kickset: String,
    pub lineclear_are: u64,
    // pub lockresets: u64,
    // pub locktime: u64,
    // pub manual_allowed: bool,
    // pub messiness_change: f64,
    // pub messiness_inner: f64,
    // pub messiness_nosame: bool,
    // pub messiness_timeout: f64,
    // pub mission: String,
    // pub mission_type: String,
    // pub neverstopbgm: bool,
    // pub new_payback: bool,
    // pub nextcount: u64,
    // pub noextrawidth: bool,
    // pub nolockout: bool,
    // pub objective_type: String,
    // pub openerphase: u64,
    // pub passthrough: String,
    // pub precountdown: u64,
    // pub prestart: u64,
    // pub retryisclear: bool,
    // pub room_handling: String,
    // pub room_handling_arr: u64,
    // pub room_handling_das: u64,
    // pub room_handling_sdf: u64,
    // pub roundmode: String,
    pub seed: u64,
    pub seed_random: bool,
    // pub slot_bar1: String,
    // pub slot_bar2: String,
    // pub slot_counter1: String,
    // pub slot_counter2: String,
    // pub slot_counter3: String,
    // pub slot_counter4: String,
    // pub slot_counter5: String,
    pub spinbonuses: String,
    pub stock: u64,
    // pub stride: bool,
    // pub usebombs: bool,
    pub version: u64,
    // pub zoominto: String,
}