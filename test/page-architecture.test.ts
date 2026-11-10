import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
const root=process.cwd();
async function load<T>(path:string):Promise<T>{return JSON.parse(await readFile(join(root,path),"utf8")) as T;}
test("pages reference existing layouts and HTML entries",async()=>{for(const id of ["home","classic","guild","discovery"]){const page=await load<{id:string;entry:string;layout:string;sections:{id:string;contentRef:string}[]}>(`pages/pt-BR/${id}.json`);assert.equal(page.id,id);await readFile(join(root,page.entry),"utf8");await readFile(join(root,`layouts/${page.layout}.json`),"utf8");assert.ok(page.sections.length>0);assert.ok(page.sections.every(s=>s.id&&s.contentRef));}});
test("mission and discovery content are externalized and complete",async()=>{const steps=await load<{id:string;prompt:string}[]>("content/mission-steps.pt-BR.json");const discovery=await load<{stages:{id:string;questions:{id:string}[]}[];solutions:{id:string}[]}>("content/discovery.pt-BR.json");assert.equal(steps.length,7);assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);assert.ok(steps.every(s=>s.prompt.trim().length>0));assert.equal(discovery.stages.length,19);assert.equal(discovery.solutions.length,12);assert.ok(discovery.stages.every(s=>s.id&&s.questions.length>0));});
test("layout descriptors define template, stylesheet and renderer",async()=>{for(const id of ["chooser","classic","guild","discovery"]){const layout=await load<{id:string;template:string;stylesheet:string;renderer:string;slots:string[]}>(`layouts/${id}.json`);assert.equal(layout.id,id);assert.ok(layout.template&&layout.stylesheet&&layout.renderer&&layout.slots.length>0);}});
