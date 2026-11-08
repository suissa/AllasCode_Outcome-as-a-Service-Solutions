export interface BackupManifest{id:string;tenantId:string;createdAt:string;formatVersion:string;contentHash:string;sizeBytes:number;scope:string[]}export function validateBackup(m:BackupManifest):void{if(!m.id||!m.tenantId||Number.isNaN(Date.parse(m.createdAt))||!m.scope.length||!/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/i.test(m.contentHash)||!m.formatVersion||m.sizeBytes<0||!Number.isInteger(m.sizeBytes))throw new Error("BACKUP_MANIFEST_INVALID")}export function verifyBackup(m:BackupManifest,actualHash:string):boolean{return m.contentHash===actualHash}export interface ExportRequest{tenantId:string;requestedBy:string;purpose:string;includePersonalData:boolean;approvedBy?:string}
export interface ExportAuthorization { tenantId: string; requestedBy: string; purpose: string; approvedBy?: string; authorizedAt: string; includePersonalData: boolean }
export function authorizeExport(r: ExportRequest, at=new Date()): ExportAuthorization {
  if (!r.tenantId || !r.requestedBy || !r.purpose.trim()) throw new Error("EXPORT_REQUEST_INVALID");
  if (r.includePersonalData && (!r.approvedBy || r.approvedBy === r.requestedBy)) throw new Error("PERSONAL_DATA_EXPORT_APPROVAL_REQUIRED");
  return Object.freeze({ tenantId:r.tenantId, requestedBy:r.requestedBy, purpose:r.purpose, ...(r.approvedBy ? { approvedBy:r.approvedBy } : {}), authorizedAt:at.toISOString(), includePersonalData:r.includePersonalData });
}
export interface BackupRestorePort { restore(manifest:BackupManifest):Promise<void> }
export function verifyBackupRestore(m:BackupManifest,actualHash:string):boolean{validateBackup(m);return verifyBackup(m,actualHash)}
export async function restoreBackup(m: BackupManifest, actualHash: string, restorer:BackupRestorePort): Promise<{ restored: false; error: "BACKUP_INTEGRITY_FAILED" } | { restored: true; tenantId: string; scope: readonly string[] }> {
  validateBackup(m);
  if (!verifyBackup(m, actualHash)) return { restored:false, error:"BACKUP_INTEGRITY_FAILED" };
  await restorer.restore(m);
  return Object.freeze({ restored:true, tenantId:m.tenantId, scope:[...m.scope] });
}
