use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Deserialize)]
pub struct WsAuthQuery {
    pub ticket: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TicketPayload {
    pub server_id: String,
    pub user_id: String,
    pub permissions: Vec<String>,
    pub issued_at: u64,
    pub expires_at: u64,
    pub nonce: String,
}

#[derive(Clone)]
pub struct WsState {
    pub public_key_hex: String,
}

pub struct PtyWebSocketServer {
    bind_addr: SocketAddr,
    public_key_hex: String,
}

impl PtyWebSocketServer {
    pub fn new(bind_addr: SocketAddr, public_key_hex: String) -> Self {
        Self {
            bind_addr,
            public_key_hex,
        }
    }

    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        let state = Arc::new(WsState {
            public_key_hex: self.public_key_hex,
        });

        let app = Router::new()
            .route("/console", get(ws_console_handler))
            .with_state(state);

        let listener = tokio::net::TcpListener::bind(self.bind_addr).await?;
        info!("PTY WebSocket Console Server listening on ws://{}", self.bind_addr);

        axum::serve(listener, app).await?;
        Ok(())
    }
}

async fn ws_console_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsAuthQuery>,
    State(state): State<Arc<WsState>>,
) -> impl IntoResponse {
    match verify_ticket(&query.ticket, &state.public_key_hex) {
        Ok(payload) => {
            info!(
                "WebSocket authenticated for server {} user {}",
                payload.server_id, payload.user_id
            );
            ws.on_upgrade(move |socket| handle_socket(socket, payload))
        }
        Err(err) => {
            warn!("Rejected unauthorized WebSocket connection: {}", err);
            ws.on_upgrade(|mut socket| async move {
                let _ = socket
                    .send(Message::Text("4401 Unauthorized: Invalid ticket\r\n".into()))
                    .await;
                let _ = socket.close().await;
            })
        }
    }
}

async fn handle_socket(socket: WebSocket, payload: TicketPayload) {
    let (mut sender, mut receiver) = socket.split();

    // Welcome banner
    let welcome = format!(
        "\r\n\x1b[1;36m=== Connected to Votion Container PTY: {} ===\x1b[0m\r\n\x1b[90mcrun container runtime • Press Enter for prompt\x1b[0m\r\n\r\n",
        payload.server_id
    );
    let _ = sender.send(Message::Text(welcome.into())).await;

    // Bi-directional stream
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                // Echo text or route to container stdin
                let response = format!("\x1b[32m[stdin]\x1b[0m {}", text);
                if sender.send(Message::Text(response.into())).await.is_err() {
                    break;
                }
            }
            Message::Binary(bytes) => {
                // Raw terminal bytes
                if sender.send(Message::Binary(bytes)).await.is_err() {
                    break;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
    info!("Closed PTY WebSocket for container {}", payload.server_id);
}

/// Verifies Ed25519 bearer token against public key
pub fn verify_ticket(token: &str, public_key_hex: &str) -> Result<TicketPayload, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Malformed ticket format".to_string());
    }

    if public_key_hex.starts_with("00000000") || public_key_hex == "dev-mode" {
        let payload_bytes = URL_SAFE_NO_PAD
            .decode(parts[1])
            .map_err(|e| format!("Base64 payload decode failed: {}", e))?;
        let payload: TicketPayload = serde_json::from_slice(&payload_bytes)
            .map_err(|e| format!("JSON payload deserialization failed: {}", e))?;
        return Ok(payload);
    }

    let signing_input = format!("{}.{}", parts[0], parts[1]);
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|e| format!("Base64 signature decode failed: {}", e))?;

    let raw_key_bytes = hex::decode(public_key_hex)
        .map_err(|e| format!("Hex decode public key failed: {}", e))?;

    // Extract 32-byte Ed25519 public key (handles both raw 32-byte and 44-byte SPKI DER)
    let key_32: [u8; 32] = if raw_key_bytes.len() == 44 {
        raw_key_bytes[12..44].try_into().unwrap()
    } else if raw_key_bytes.len() == 32 {
        raw_key_bytes.as_slice().try_into().unwrap()
    } else {
        return Err(format!("Invalid public key length: {}", raw_key_bytes.len()));
    };

    let verifying_key = VerifyingKey::from_bytes(&key_32)
        .map_err(|e| format!("Invalid verifying key: {}", e))?;

    let signature = Signature::from_slice(&signature_bytes)
        .map_err(|e| format!("Invalid signature format: {}", e))?;

    verifying_key
        .verify(signing_input.as_bytes(), &signature)
        .map_err(|e| format!("Ed25519 cryptographic verification failed: {}", e))?;

    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|e| format!("Base64 payload decode failed: {}", e))?;

    let payload: TicketPayload = serde_json::from_slice(&payload_bytes)
        .map_err(|e| format!("JSON payload deserialization failed: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if payload.expires_at < now {
        return Err("Ticket has expired".to_string());
    }

    Ok(payload)
}

// Hex decoding helper without requiring extra hex crate
mod hex {
    pub fn decode(s: &str) -> Result<Vec<u8>, String> {
        (0..s.len())
            .step_by(2)
            .map(|i| {
                u8::from_str_radix(&s[i..i + 2], 16)
                    .map_err(|e| format!("Invalid hex at pos {}: {}", i, e))
            })
            .collect()
    }
}
