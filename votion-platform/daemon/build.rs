fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=../proto/votion.proto");
    tonic_build::compile_protos("../proto/votion.proto")?;
    Ok(())
}
