//! `Page<T>` envelope and `?limit=&offset=` parameters.

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

pub const DEFAULT_LIMIT: i64 = 50;
pub const MAX_LIMIT: i64 = 200;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Default, Clone, Copy, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct PageParams {
    /// Page size (default 50, max 200)
    pub limit: Option<i64>,
    /// Offset (default 0)
    pub offset: Option<i64>,
}

impl PageParams {
    /// Returns sanitised `(limit, offset)`.
    pub fn resolve(&self) -> (i64, i64) {
        let limit = self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
        let offset = self.offset.unwrap_or(0).max(0);
        (limit, offset)
    }
}
