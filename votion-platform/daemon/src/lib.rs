pub mod console;
pub mod monitor;
pub mod rpc;
pub mod runtime;
pub mod wings_adapter;

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use ed25519_dalek::{Signer, SigningKey};
    use std::collections::HashMap;
    use std::path::PathBuf;

    #[test]
    fn test_oci_bundle_spec_generation() {
        let bundle_dir = PathBuf::from("target/test-bundle");
        let mut env = HashMap::new();
        env.insert("SERVER_PORT".to_string(), "25565".to_string());
        env.insert("SERVER_MEMORY".to_string(), "4096".to_string());

        let builder = runtime::oci::OciBundleBuilder::new("test-srv-01", bundle_dir)
            .with_command(vec!["/usr/bin/java".to_string(), "-jar".to_string(), "server.jar".to_string()])
            .with_environment(env)
            .with_limits(4 * 1024 * 1024 * 1024, 3800 * 1024 * 1024, 200, 200);

        let spec = builder.build_spec();
        assert_eq!(spec.oci_version, "1.0.2");
        assert_eq!(spec.process.args, vec!["/usr/bin/java", "-jar", "server.jar"]);
        assert!(spec.process.env.iter().any(|e| e == "SERVER_PORT=25565"));

        let linux = spec.linux.expect("Linux spec missing");
        let res = linux.resources.expect("Resources missing");
        let mem = res.memory.expect("Memory limits missing");
        assert_eq!(mem.limit, Some(4 * 1024 * 1024 * 1024));
        assert_eq!(mem.reservation, Some(3800 * 1024 * 1024));

        let cpu = res.cpu.expect("CPU limits missing");
        assert_eq!(cpu.shares, Some(200));
        assert_eq!(cpu.quota, Some(200_000)); // 200% = 200,000us on 100,000us period
    }

    #[tokio::test]
    async fn test_hibernation_manager_lifecycle() {
        let mgr = monitor::HibernationManager::new();
        mgr.register_container("srv-mc-01".to_string(), 1, 0, vec![25565], true).await;

        assert!(!mgr.is_hibernating("srv-mc-01").await);

        // Sleep to exceed idle timeout
        tokio::time::sleep(std::time::Duration::from_millis(1100)).await;

        let mut frozen_containers = Vec::new();
        mgr.check_hibernation_candidates(|id, freeze| {
            if freeze {
                frozen_containers.push(id.to_string());
            }
        })
        .await;

        assert!(frozen_containers.contains(&"srv-mc-01".to_string()));
        assert!(mgr.is_hibernating("srv-mc-01").await);

        // Packet / player activity triggers thaw
        mgr.record_activity("srv-mc-01").await;
        assert!(!mgr.is_hibernating("srv-mc-01").await);
    }

    #[test]
    fn test_ed25519_ticket_verification() {
        let signing_key = SigningKey::from_bytes(&[42u8; 32]);
        let verifying_key = signing_key.verifying_key();
        let pub_hex = hex_encode(verifying_key.as_bytes());

        let header = URL_SAFE_NO_PAD.encode(r#"{"alg":"Ed25519","typ":"VOTION-TICKET"}"#);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let payload_json = format!(
            r#"{{"server_id":"srv-test-01","user_id":"usr_bob","permissions":["console.read"],"issued_at":{},"expires_at":{},"nonce":"test-nonce"}}"#,
            now,
            now + 60
        );
        let payload = URL_SAFE_NO_PAD.encode(payload_json.as_bytes());
        let signing_input = format!("{}.{}", header, payload);

        let signature = signing_key.sign(signing_input.as_bytes());
        let sig_encoded = URL_SAFE_NO_PAD.encode(signature.to_bytes());
        let token = format!("{}.{}", signing_input, sig_encoded);

        // Verify valid token
        let verified = console::pty_ws::verify_ticket(&token, &pub_hex).expect("Verification failed");
        assert_eq!(verified.server_id, "srv-test-01");
        assert_eq!(verified.user_id, "usr_bob");
        assert!(verified.permissions.contains(&"console.read".to_string()));

        // Verify tampered token is rejected
        let tampered_token = format!("{}x.{}", &signing_input[1..], sig_encoded);
        assert!(console::pty_ws::verify_ticket(&tampered_token, &pub_hex).is_err());
    }

    fn hex_encode(data: &[u8]) -> String {
        data.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
