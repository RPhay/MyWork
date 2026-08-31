fn main() {
    // SkyLight (the Spaces API in src/main.rs's `spaces` module) is a
    // private framework, so its search path must be added by hand.
    println!("cargo:rustc-link-search=framework=/System/Library/PrivateFrameworks");
    tauri_build::build()
}
