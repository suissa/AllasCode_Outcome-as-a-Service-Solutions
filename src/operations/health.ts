export interface HealthCheck{name:string;status:"healthy"|"degraded"|"unhealthy";checkedAt:string;latencyMs:number;details?:string}export interface SloBreach{slo:string;observed:number;threshold:number;window:string;severity:"warning"|"critical"}export function detectSloBreach(slo:string,observed:number,threshold:number,lowerIsBetter=true):SloBreach|undefined{const breached=lowerIsBetter?observed>threshold:observed<threshold;if(!breached)return;return{slo,observed,threshold,window:"configured",severity:Math.abs(observed-threshold)>threshold*.5?"critical":"warning"}}
export function aggregateHealth(checks: readonly HealthCheck[]): "healthy"|"degraded"|"unhealthy" {
  if (!checks.length || checks.some(c => c.status === "unhealthy")) return "unhealthy";
  if (checks.some(c => c.status === "degraded")) return "degraded";
  return "healthy";
}
export function validateHealthCheck(c: HealthCheck): string[] {
  const errors: string[] = [];
  if (!c.name.trim()) errors.push("HEALTH_NAME_REQUIRED");
  if (!Number.isFinite(c.latencyMs) || c.latencyMs < 0) errors.push("HEALTH_LATENCY_INVALID");
  if (Number.isNaN(Date.parse(c.checkedAt))) errors.push("HEALTH_TIMESTAMP_INVALID");
  return errors;
}
