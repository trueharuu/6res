use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Environment {
    pub signature: Signature,
}

#[derive(Clone, Debug, Serialize, Deserialize)]

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
pub struct User {}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "command", content = "data")]
#[serde(rename_all = "snake_case")]
pub enum Packet {
    New,
    Packets {
        packets: Vec<Packet>,
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
    ServerAuthorize {
        handling: Handling,
        signature: Signature,
        token: String,

    },
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
