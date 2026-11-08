export interface ConnectorManifest{id:string;version:string;name:string;capabilities:string[];timeoutMs:number;maxRetries:number;idempotent:boolean;allowedHosts:string[]}export interface ConnectorRequest{tenantId:string;actorId:string;operation:string;payload:unknown;idempotencyKey:string;correlationId:string}export interface ConnectorResult{status:"success"|"retryable_error"|"permanent_error";output?:unknown;errorCode?:string;externalReference?:string}export interface Connector{manifest:ConnectorManifest;execute(request:ConnectorRequest,signal?:AbortSignal):Promise<ConnectorResult>}
export interface ConnectorDispatchResult { result: ConnectorResult; attempts: number; completedAt: string }export function validateConnectorRequest(m:ConnectorManifest,r:ConnectorRequest):void{if(!r.idempotencyKey)throw new Error("CONNECTOR_IDEMPOTENCY_REQUIRED");if(!r.tenantId||!r.actorId||!r.correlationId)throw new Error("CONNECTOR_CONTEXT_REQUIRED");if(m.timeoutMs<=0||m.maxRetries<0||!Number.isInteger(m.maxRetries))throw new Error("CONNECTOR_BUDGET_INVALID");if(m.capabilities.length&&!m.capabilities.includes(r.operation))throw new Error("CONNECTOR_CAPABILITY_DENIED");const target=(r.payload&&typeof r.payload==="object"?(r.payload as Record<string,unknown>).url:undefined);if(target!==undefined){if(typeof target!=="string")throw new Error("CONNECTOR_URL_INVALID");const url=new URL(target);if(url.protocol!=="https:"||!m.allowedHosts.includes(url.hostname))throw new Error("CONNECTOR_HOST_DENIED")}}
export async function dispatchConnector(connector: Connector, request: ConnectorRequest, now=()=>new Date()): Promise<ConnectorDispatchResult> {
  validateConnectorRequest(connector.manifest, request);
  let attempts = 0;
  let last: ConnectorResult = { status:"permanent_error", errorCode:"CONNECTOR_NOT_EXECUTED" };
  while (attempts <= connector.manifest.maxRetries) {
    attempts += 1;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>|undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("CONNECTOR_TIMEOUT")); }, connector.manifest.timeoutMs);
      });
      const result = await Promise.race([connector.execute(request, controller.signal), timeout]);
      last = result;
      if (result.status === "success" || result.status === "permanent_error") break;
      if (attempts > connector.manifest.maxRetries) break;
    } catch (error) {
      const code = error instanceof Error ? error.message : "CONNECTOR_EXECUTION_FAILED";
      last = { status:"retryable_error", errorCode:code };
      if (code === "CONNECTOR_TIMEOUT" && !connector.manifest.idempotent) {
        last = { status:"permanent_error", errorCode:"CONNECTOR_TIMEOUT_UNCERTAIN" }; break;
      }
      if (attempts > connector.manifest.maxRetries) break;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return Object.freeze({ result:last, attempts, completedAt:now().toISOString() });
}
