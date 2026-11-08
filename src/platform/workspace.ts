import type{TenantId}from "../domain/tenant-scope.ts";export interface Workspace{id:string;tenantId:TenantId;name:string;slug:string;status:"active"|"suspended"|"archived";createdAt:string}export interface Membership{workspaceId:string;tenantId:TenantId;actorId:string;role:string;status:"invited"|"active"|"revoked";invitedBy:string;createdAt:string;expiresAt?:string;invitationTokenHash?:string}export function validateWorkspace(w:Workspace):string[]{const e:string[]=[];if(!w.name.trim())e.push("name:REQUIRED");if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(w.slug))e.push("slug:INVALID");if(!w.tenantId)e.push("tenantId:REQUIRED");return e}export function createInvitation(input: Omit<Membership,"status"|"createdAt">, now=new Date()): Membership {
  if(!input.workspaceId||!input.tenantId||!input.actorId||!input.invitedBy||!input.role||!input.invitationTokenHash)throw new Error("INVITATION_FIELDS_REQUIRED");
  if(!input.expiresAt||Date.parse(input.expiresAt)<=now.getTime())throw new Error("INVITATION_EXPIRY_INVALID");
  return Object.freeze({...input,status:"invited",createdAt:now.toISOString()});
}
export function acceptInvitation(m:Membership,actor:string,tokenHash?:string,now=new Date()):Membership{
  if(m.status!=="invited")throw new Error("INVITATION_NOT_PENDING");
  if(actor!==m.actorId)throw new Error("INVITATION_ACTOR_MISMATCH");
  if(m.expiresAt&&Date.parse(m.expiresAt)<=now.getTime())throw new Error("INVITATION_EXPIRED");
  if(m.invitationTokenHash&&m.invitationTokenHash!==tokenHash)throw new Error("INVITATION_TOKEN_INVALID");
  return Object.freeze({...m,status:"active"});
}
export function revokeMembership(m:Membership,actor:string):Membership{
  if(!actor)throw new Error("MEMBERSHIP_REVOKER_REQUIRED");
  if(m.status==="revoked")throw new Error("MEMBERSHIP_ALREADY_REVOKED");
  return Object.freeze({...m,status:"revoked"});
}
export class WorkspaceRegistry {
  private readonly workspaces=new Map<string,Workspace>();
  create(workspace:Workspace):Workspace{
    const errors=validateWorkspace(workspace);if(errors.length)throw new Error("WORKSPACE_INVALID:"+errors.join(","));
    const key=workspace.tenantId+":"+workspace.slug;if([...this.workspaces.values()].some(w=>w.tenantId+":"+w.slug===key))throw new Error("WORKSPACE_SLUG_CONFLICT");
    this.workspaces.set(workspace.tenantId+":"+workspace.id,Object.freeze({...workspace}));return workspace;
  }
  get(tenantId:string,id:string):Workspace{const w=this.workspaces.get(tenantId+":"+id);if(!w)throw new Error("WORKSPACE_NOT_FOUND");return w;}
}
