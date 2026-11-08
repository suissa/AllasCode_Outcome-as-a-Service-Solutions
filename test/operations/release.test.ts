import test from "node:test";
import assert from "node:assert/strict";
import { approveRelease, completeRelease, createReleaseCandidate, rollbackRelease, startRelease } from "../../src/operations/release.ts";
test("release gates require independent approval, verified CI/security/migrations and rollback plan",()=>{
 const candidate=createReleaseCandidate({id:"release_001",version:"1.2.0",previousVersion:"1.1.0",commitSha:"a".repeat(40),createdBy:"release_owner",migrationIds:["0005_intent_versions.sql"],featureFlags:["new-runtime"],rollbackPlan:["disable-new-runtime","restore-previous-version"],checks:{ciPassed:true,securityPassed:true,migrationsVerified:true}});
 assert.throws(()=>approveRelease(candidate,"release_owner"),/RELEASE_APPROVAL_INVALID/);
 const approved=approveRelease(candidate,"reviewer");const deployed=completeRelease(startRelease(approved));
 assert.equal(deployed.status,"deployed");
 assert.throws(()=>rollbackRelease(deployed,"reviewer"),/RELEASE_ROLLBACK_APPROVAL_INVALID/);
 assert.equal(rollbackRelease(deployed,"operator").status,"rolled_back");
});
test("release cannot bypass failed quality gates",()=>{
 const candidate=createReleaseCandidate({id:"release_002",version:"1.2.1",previousVersion:"1.2.0",commitSha:"b".repeat(40),createdBy:"owner",migrationIds:["0006"],featureFlags:[],rollbackPlan:["restore"],checks:{ciPassed:false,securityPassed:true,migrationsVerified:true}});
 assert.throws(()=>approveRelease(candidate,"reviewer"),/RELEASE_GATES_FAILED/);
});
