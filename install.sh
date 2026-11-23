#!/usr/bin/env bash
set -e

echo "=== Antigravity ModLoader Cross-Platform Setup ==="

# Check OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="darwin";;
    *)          PLATFORM="unknown";;
esac

echo "Detected platform: ${PLATFORM}"

if [ "${PLATFORM}" = "unknown" ]; then
    echo "Error: Unsupported OS ${OS}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If Rust cargo is installed, build binary or run directly
if command -v cargo >/dev/null 2>&1; then
    echo "Building installer via cargo..."
    cd "${SCRIPT_DIR}/installer-rs"
    cargo build --release
    TARGET_BIN="${SCRIPT_DIR}/installer-rs/target/release/antigravity-modloader-setup"
    echo "Running installer..."
    "${TARGET_BIN}" "$@"
elif command -v node >/dev/null 2>&1; then
    echo "Cargo not found, falling back to node CLI patcher..."
    node "${SCRIPT_DIR}/cli/install.js" "$@"
else
    echo "Error: Neither cargo nor node found in PATH. Install Rust or Node.js to run the installer on Linux/macOS."
    exit 1
fi
