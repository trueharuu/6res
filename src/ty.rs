use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Environment {
    pub signature: EnvironmentSignature,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EnvironmentSignature {
    pub noceriad: bool,
    pub novault: bool,
    pub version: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    
}