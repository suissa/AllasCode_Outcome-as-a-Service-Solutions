# Implementation notes

validateDataHandling is a pure guard. It rejects unknown classifications, blank purposes, missing lawful basis for personal/sensitive data, invalid retention timestamps and expired retention. The optional now parameter makes boundary tests deterministic.

consentIsValid is fail-closed: malformed records/timestamps, future capture, purpose mismatch, expired consent or any withdrawal make the record invalid. Tenant and subject identifiers must be present; callers must additionally compare them with the authenticated request context before using a consent record.

withdrawConsent validates capture/withdrawal chronology and returns a frozen copy with granted=false. It does not persist the record or create an audit event; the application service must do both atomically with its business operation.

Errors are stable machine-readable codes. No coercive parsing, silent repair, default legal basis or automatic retention extension is permitted.
