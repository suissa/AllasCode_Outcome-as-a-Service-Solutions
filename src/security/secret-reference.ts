export interface SecretReference{provider:string;key:string;version?:string;expiresAt?:string}export function validateSecretReference(s:SecretReference,now=new Date()):void{if(!s.provider||!s.key)throw new Error("SECRET_REFERENCE_REQUIRED");if(s.expiresAt&&Date.parse(s.expiresAt)<=now.getTime())throw new Error("SECRET_EXPIRED")}export function redact(value:unknown):unknown{if(Array.isArray(value))return value.map(redact);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[/secret|token|password|credential|authorization/i.test(k)?k:""+k,/secret|token|password|credential|authorization/i.test(k)?"[REDACTED]":redact(v)]));return value}
export interface SecretRotation { previous: SecretReference; current: SecretReference; rotatedBy: string; rotatedAt: string; revokePrevious: boolean }
export function rotateSecretReference(current: SecretReference, nextVersion: string, actor: string, expiresAt?: string, at=new Date()): SecretRotation {
  validateSecretReference(current, at);
  if (!actor || !nextVersion.trim() || nextVersion === current.version) throw new Error("SECRET_ROTATION_METADATA_INVALID");
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new Error("SECRET_EXPIRY_INVALID");
  const next: SecretReference = { provider: current.provider, key: current.key, version: nextVersion, ...(expiresAt ? { expiresAt } : {}) };
  return Object.freeze({ previous: current, current: Object.freeze(next), rotatedBy: actor, rotatedAt: at.toISOString(), revokePrevious: true });
}
