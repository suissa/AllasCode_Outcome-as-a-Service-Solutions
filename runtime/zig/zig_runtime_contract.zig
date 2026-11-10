const std = @import("std");

pub const Request = struct {
    protocol_version: []const u8,
    tenant_id: []const u8,
    execution_id: []const u8,
    behavior_id: []const u8,
    command: []const u8,
    input_digest: []const u8,
    policy_digest: []const u8,
    proof_refs: []const []const u8,
};

pub const Response = struct {
    protocol_version: []const u8,
    execution_id: []const u8,
    status: []const u8,
    output_digest: ?[]const u8 = null,
    evidence_refs: []const []const u8,
    error_code: ?[]const u8 = null,
};

pub const ValidationError = error{
    ProtocolVersion,
    EmptyRequiredField,
    UnknownCommand,
    UnknownStatus,
    MissingOutputDigest,
    MissingErrorCode,
    EmptyProofReference,
    EmptyEvidenceReference,
    CorrelationMismatch,
};

fn nonEmpty(value: []const u8) bool {
    return value.len != 0;
}

fn allowedCommand(value: []const u8) bool {
    const commands = [_][]const u8{
        "validate-contract",
        "evaluate-policy",
        "execute-approved-behavior",
        "verify-invariant",
    };
    for (commands) |command| {
        if (std.mem.eql(u8, value, command)) return true;
    }
    return false;
}

fn allowedStatus(value: []const u8) bool {
    const statuses = [_][]const u8{ "accepted", "rejected", "completed", "failed" };
    for (statuses) |status| {
        if (std.mem.eql(u8, value, status)) return true;
    }
    return false;
}

pub fn validateRequest(request: Request) ValidationError!void {
    if (!std.mem.eql(u8, request.protocol_version, "1")) return error.ProtocolVersion;
    if (!nonEmpty(request.tenant_id) or
        !nonEmpty(request.execution_id) or
        !nonEmpty(request.behavior_id) or
        !nonEmpty(request.input_digest) or
        !nonEmpty(request.policy_digest))
        return error.EmptyRequiredField;
    if (!allowedCommand(request.command)) return error.UnknownCommand;
    for (request.proof_refs) |reference| {
        if (!nonEmpty(reference)) return error.EmptyProofReference;
    }
}

pub fn validateResponse(request: Request, response: Response) ValidationError!void {
    if (!std.mem.eql(u8, response.protocol_version, request.protocol_version) or
        !std.mem.eql(u8, response.execution_id, request.execution_id))
        return error.CorrelationMismatch;
    if (!allowedStatus(response.status)) return error.UnknownStatus;
    if (std.mem.eql(u8, response.status, "completed")) {
        if (response.output_digest == null or !nonEmpty(response.output_digest.?))
            return error.MissingOutputDigest;
    }
    if (std.mem.eql(u8, response.status, "failed")) {
        if (response.error_code == null or !nonEmpty(response.error_code.?))
            return error.MissingErrorCode;
    }
    for (response.evidence_refs) |reference| {
        if (!nonEmpty(reference)) return error.EmptyEvidenceReference;
    }
}

test "valid request and completed response conform to protocol v1" {
    const request = Request{
        .protocol_version = "1",
        .tenant_id = "tenant-a",
        .execution_id = "exec-1",
        .behavior_id = "behavior-1",
        .command = "execute-approved-behavior",
        .input_digest = "sha256:input",
        .policy_digest = "sha256:policy",
        .proof_refs = &.{"proof-1"},
    };
    try validateRequest(request);
    try validateResponse(request, .{
        .protocol_version = "1",
        .execution_id = "exec-1",
        .status = "completed",
        .output_digest = "sha256:output",
        .evidence_refs = &.{"evidence-1"},
    });
}

test "unknown commands fail closed" {
    const request = Request{
        .protocol_version = "1",
        .tenant_id = "tenant-a",
        .execution_id = "exec-1",
        .behavior_id = "behavior-1",
        .command = "run-shell",
        .input_digest = "sha256:input",
        .policy_digest = "sha256:policy",
        .proof_refs = &.{},
    };
    try std.testing.expectError(error.UnknownCommand, validateRequest(request));
}

test "completed response requires output digest" {
    const request = Request{
        .protocol_version = "1",
        .tenant_id = "tenant-a",
        .execution_id = "exec-1",
        .behavior_id = "behavior-1",
        .command = "verify-invariant",
        .input_digest = "sha256:input",
        .policy_digest = "sha256:policy",
        .proof_refs = &.{},
    };
    try std.testing.expectError(error.MissingOutputDigest, validateResponse(request, .{
        .protocol_version = "1",
        .execution_id = "exec-1",
        .status = "completed",
        .evidence_refs = &.{},
    }));
}

test "response correlation cannot cross execution boundaries" {
    const request = Request{
        .protocol_version = "1",
        .tenant_id = "tenant-a",
        .execution_id = "exec-1",
        .behavior_id = "behavior-1",
        .command = "validate-contract",
        .input_digest = "sha256:input",
        .policy_digest = "sha256:policy",
        .proof_refs = &.{},
    };
    try std.testing.expectError(error.CorrelationMismatch, validateResponse(request, .{
        .protocol_version = "1",
        .execution_id = "exec-other",
        .status = "accepted",
        .evidence_refs = &.{},
    }));
}

test "failed response requires stable error code" {
    const request = Request{
        .protocol_version = "1",
        .tenant_id = "tenant-a",
        .execution_id = "exec-1",
        .behavior_id = "behavior-1",
        .command = "evaluate-policy",
        .input_digest = "sha256:input",
        .policy_digest = "sha256:policy",
        .proof_refs = &.{},
    };
    try std.testing.expectError(error.MissingErrorCode, validateResponse(request, .{
        .protocol_version = "1",
        .execution_id = "exec-1",
        .status = "failed",
        .evidence_refs = &.{},
    }));
}
