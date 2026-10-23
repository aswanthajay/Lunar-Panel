use clap::Parser;

#[derive(Parser)]
enum Command {
    BuildEbpf,
}

fn main() -> anyhow::Result<()> {
    println!("Aya eBPF xtask runner: Compiles kernel-space programs into bytecode");
    Ok(())
}
