//! HS256 JWTs: access tokens (aud `api`) and short-lived WebSocket tickets (aud `ws`).

use chrono::Utc;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use crate::domain::Role;
use crate::error::{AppError, AppResult};

pub const AUD_API: &str = "api";
pub const AUD_WS: &str = "ws";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// User id (stringified, per RFC 7519).
    pub sub: String,
    pub role: Role,
    pub username: String,
    pub exp: i64,
    pub iat: i64,
    pub aud: String,
    /// Unique id; set on WS tickets so they can be used only once.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub jti: Option<String>,
}

impl Claims {
    pub fn user_id(&self) -> AppResult<i64> {
        self.sub.parse().map_err(|_| AppError::unauthorized())
    }
}

pub struct JwtKeys {
    enc: EncodingKey,
    dec: DecodingKey,
    pub access_ttl: i64,
    pub ws_ttl: i64,
}

impl JwtKeys {
    pub fn new(secret: &[u8], access_ttl: i64, ws_ttl: i64) -> Self {
        Self {
            enc: EncodingKey::from_secret(secret),
            dec: DecodingKey::from_secret(secret),
            access_ttl,
            ws_ttl,
        }
    }

    /// Sign arbitrary claims (exposed for tests, e.g. to craft expired tokens).
    pub fn sign(&self, claims: &Claims) -> AppResult<String> {
        encode(&Header::new(Algorithm::HS256), claims, &self.enc).map_err(AppError::internal)
    }

    pub fn issue_access(&self, user_id: i64, role: Role, username: &str) -> AppResult<String> {
        let now = Utc::now().timestamp();
        self.sign(&Claims {
            sub: user_id.to_string(),
            role,
            username: username.to_string(),
            iat: now,
            exp: now + self.access_ttl,
            aud: AUD_API.into(),
            jti: None,
        })
    }

    pub fn issue_ws_ticket(&self, user_id: i64, role: Role, username: &str) -> AppResult<String> {
        let now = Utc::now().timestamp();
        let jti: [u8; 16] = rand::random();
        self.sign(&Claims {
            sub: user_id.to_string(),
            role,
            username: username.to_string(),
            iat: now,
            exp: now + self.ws_ttl,
            aud: AUD_WS.into(),
            jti: Some(hex::encode(jti)),
        })
    }

    /// Verify signature, expiry (no leeway) and audience.
    pub fn verify(&self, token: &str, audience: &str) -> AppResult<Claims> {
        let mut v = Validation::new(Algorithm::HS256);
        v.set_audience(&[audience]);
        v.set_required_spec_claims(&["exp", "aud", "sub"]);
        v.leeway = 0;
        decode::<Claims>(token, &self.dec, &v)
            .map(|d| d.claims)
            .map_err(|_| AppError::Unauthorized("invalid or expired token".into()))
    }
}
