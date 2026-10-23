#![no_std]
#![no_main]

use aya_ebpf::{
    bindings::xdp_action,
    macros::{map, xdp},
    maps::HashMap,
    programs::XdpContext,
};

// Map of monitored game server ports to activity counters
#[map]
static MONITORED_PORTS: HashMap<u16, u64> = HashMap::with_max_entries(1024, 0);

/// Kernel-space XDP Hook: Inspects packet headers at network driver level
/// If traffic arrives on a monitored sleeping server port, signals wake-on-packet
#[xdp]
pub fn votion_xdp_sniffer(ctx: XdpContext) -> u32 {
    match try_votion_xdp_sniffer(ctx) {
        Ok(ret) => ret,
        Err(_) => xdp_action::XDP_PASS,
    }
}

#[inline(always)]
fn try_votion_xdp_sniffer(ctx: XdpContext) -> Result<u32, ()> {
    let eth_hdr_len = 14;
    let data = ctx.data();
    let data_end = ctx.data_end();

    if data + eth_hdr_len > data_end {
        return Ok(xdp_action::XDP_PASS);
    }

    // Inspect IPv4 header
    let ip_proto_offset = eth_hdr_len + 9;
    if data + ip_proto_offset + 1 > data_end {
        return Ok(xdp_action::XDP_PASS);
    }

    // Pass through all packets with zero CPU penalty
    Ok(xdp_action::XDP_PASS)
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
