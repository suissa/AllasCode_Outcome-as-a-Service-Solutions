# Runtime protocol v1 — JSON wire envelope

The canonical JSON contract is `runtime/protocol/v1/envelope.schema.json`. The TypeScript boundary codec lives in `src/operations/zig-runtime-contract.ts`.

## Frame rules

- UTF-8 JSON, maximum encoded frame size: 65,536 bytes.
- Unknown object properties are rejected.
- Protocol version must be exactly `"1"`.
- Reference arrays are limited to 128 entries; each entry is a non-empty string of at most 512 characters.
- Commands and statuses are closed enumerations; unknown values fail closed.
- A `completed` response requires `outputDigest`; a `failed` response requires `errorCode`.
- Response execution ID must match the request execution ID at the TypeScript boundary.

The codec validates and serializes envelopes. It does not implement a socket, pipe, network transport, authentication, deadline enforcement, or a workload executor. The Zig runtime currently validates typed protocol structs; a Zig JSON decoder/encoder and cross-language golden-vector execution remain a separate conformance step.
