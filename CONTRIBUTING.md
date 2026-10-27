# Contributing to PHERO-MESH

We welcome contributions from the aviation systems, operations research, robotics, and edge computing communities.

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Development Setup

1. **Prerequisites:**
   - [Rust toolchain](https://rustup.rs/) (edition 2021 or later)
   - [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) (for WebAssembly compilation)
   - [Node.js](https://nodejs.org/) (v18+) & `npm`

2. **Building the Rust Core:**
   ```bash
   cargo build
   cargo build --release
   ```

3. **Running the Automated Test Suite:**
   ```bash
   cargo test
   ```
   All tests in `crates/ramp-math-core/tests/swarm_core_tests.rs` must pass before opening a Pull Request.

4. **Compiling WebAssembly Target:**
   ```bash
   cd crates/ramp-math-core
   wasm-pack build --target web --release
   ```

5. **Running the Web Simulation Interface:**
   ```bash
   cd packages/web-app
   npm install
   npm run dev
   ```

## Pull Request Guidelines

1. Fork the repository and create your feature branch from `main`.
2. Ensure `cargo test` passes cleanly with zero compiler warnings.
3. If introducing new scheduling algorithms or constraints, add corresponding unit and integration tests.
4. Provide a clear commit message and description of the changes in your Pull Request.

## Reporting Bugs and Feature Requests

Please use GitHub Issues to report bugs, request enhancements, or suggest new aviation turnaround datasets and benchmark scenarios.
