import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
const root=process.cwd();
async function load<T>(path:string):Promise<T>{return JSON.parse(await readFile(join(root,path),"utf8")) as T;}
test("pages reference existing layouts, templates and resolvable JSON content",async()=>{
  const sources:Record<string,string>={
    experience:"content/experience.pt-BR.json",
    "sector-playbooks":"content/sector-playbooks.pt-BR.json",
    "agent-team":"content/agent-team.pt-BR.json",
    "mission-steps":"content/mission-steps.pt-BR.json",
    discovery:"content/discovery.pt-BR.json"
  };
  for(const id of ["home","classic","guild","discovery"]){
    const page=await load<{id:string;entry:string;layout:string;contentRefs:string[];sections:{id:string;contentRef:string}[]}>(`pages/pt-BR/${id}.json`);
    assert.equal(page.id,id);
    await readFile(join(root,page.entry),"utf8");
    const layout=await load<{id:string;template:string;stylesheet:string;scripts?:string[]}>(`layouts/${page.layout}.json`);
    assert.equal(layout.id,page.layout);
    await readFile(join(root,layout.template),"utf8");
    if(layout.stylesheet!=="inline") await readFile(join(root,layout.stylesheet),"utf8");
    for(const script of layout.scripts||[]) await readFile(join(root,script),"utf8");
    assert.ok(page.sections.length>0);
    assert.ok(page.sections.every(section=>section.id&&section.contentRef));
    for(const ref of new Set([...page.contentRefs,...page.sections.map(section=>section.contentRef)])){
      const parts=ref.split(".");
      const source=parts.shift() ?? "";
      const path=parts;
      assert.ok(sources[source],`Unknown content source: ${ref}`);
      let value=await load<unknown>(sources[source]);
      for(const key of path)value=(value as Record<string,unknown>)?.[key];
      assert.notEqual(value,undefined,`Unresolved content reference: ${ref}`);
    }
  }
});
test("mission and discovery content are externalized and complete",async()=>{const steps=await load<{id:string;prompt:string}[]>("content/mission-steps.pt-BR.json");const discovery=await load<{stages:{id:string;questions:{id:string}[]}[];solutions:{id:string}[]}>("content/discovery.pt-BR.json");assert.equal(steps.length,7);assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);assert.ok(steps.every(s=>s.prompt.trim().length>0));assert.equal(discovery.stages.length,19);assert.equal(discovery.solutions.length,12);assert.ok(discovery.stages.every(s=>s.id&&s.questions.length>0));});
test("layout descriptors define template, stylesheet and renderer",async()=>{for(const id of ["chooser","classic","guild","discovery"]){const layout=await load<{id:string;template:string;stylesheet:string;renderer:string;slots:string[]}>(`layouts/${id}.json`);assert.equal(layout.id,id);assert.ok(layout.template&&layout.stylesheet&&layout.renderer&&layout.slots.length>0);}});

test("HTML entry points boot through the manifest-driven page runtime",async()=>{
  const loader=await readFile(join(root,"page-config.js"),"utf8");
  const renderer=await readFile(join(root,"content.js"),"utf8");
  assert.ok(loader.includes("window.OaaSPageReady"));
  assert.ok(loader.includes("rootElement.innerHTML"));
  assert.ok(loader.includes("oaasLayoutStylesheet"));
  assert.ok(loader.includes("window.OaaSPageScriptsReady"));
  assert.ok(loader.includes("LAYOUT_SCRIPT_FETCH_FAILED"));
  assert.ok(loader.includes("LAYOUT_STYLESHEET_FETCH_FAILED"));
  assert.ok(loader.includes("CONTENT_REFERENCE_NOT_FOUND"));
  assert.ok(renderer.includes("window.OaaSPageReady"));
  assert.ok(renderer.includes("pageRuntime.sources.experience"));
  assert.ok(renderer.includes("document.readyState"));
  for(const [path,id] of [["index.html","home"],["classico.html","classic"],["guilda.html","guild"],["descoberta/index.html","discovery"]] as const){
    const html=await readFile(join(root,path),"utf8");
    assert.ok(html.includes('data-oaas-page="'+id+'"'),path+" must declare its page id");
    assert.ok(html.includes(path==="descoberta/index.html"?"../page-config.js":"page-config.js"),path+" must load the page runtime");
    assert.ok(html.includes("oaas-page-root"),path+" must expose the template mount point");
    assert.ok(!html.includes("<script>"),path+" must not embed inline runtime scripts");
  }
});

test("layout stylesheets are external assets, not embedded in the discovery entry",async()=>{
  const discovery=await readFile(join(root,"descoberta/index.html"),"utf8");
  const stylesheet=await readFile(join(root,"layouts/discovery.css"),"utf8");
  assert.ok(stylesheet.includes(":root"));
  assert.ok(!discovery.includes("<style>"));
});

test("entry HTML delegates behavior to scripts declared by the layout",async()=>{
  for(const id of ["chooser","classic","guild","discovery"]){
    const layout=await load<{scripts?:string[]}>(`layouts/${id}.json`);
    assert.ok(layout.scripts && layout.scripts.length>0,`${id} must declare runtime scripts`);
    for(const script of layout.scripts||[]) await readFile(join(root,script),"utf8");
  }
});

test("page loader mounts templates and loads layout scripts from nested entries",async()=>{
  const loader=await readFile(join(root,"page-config.js"),"utf8");
  const window:Record<string,any>={};
  const mounted:{innerHTML:string}={innerHTML:""};
  const scriptUrls:string[]=[];
  const document:any={
    baseURI:"https://example.test/descoberta/index.html",
    body:{dataset:{oaasPage:"discovery",configRoot:"../"},append:(element:any)=>{scriptUrls.push(element.src);element.onload?.();}},
    head:{append:(element:any)=>element.onload?.()},
    documentElement:{dataset:{}},
    title:"",
    getElementById:(id:string)=>id==="oaas-page-root"?mounted:null,
    createElement:(tag:string)=>({tag,dataset:{}}),
    dispatchEvent:()=>true
  };
  const payloads:Record<string,any>={
    "pages/pt-BR/discovery.json":{id:"discovery",layout:"discovery",title:"Discovery",contentRefs:["discovery.stages"],sections:[]},
    "layouts/discovery.json":{id:"discovery",template:"layouts/discovery.html",stylesheet:"layouts/discovery.css",scripts:["runtime/discovery.js"]},
    "content/discovery.pt-BR.json":{stages:[]}
  };
  const fetch=async(input:unknown)=>{
    const path=new URL(String(input)).pathname.replace(/^\\//,"");
    const value=path==="layouts/discovery.html"?"<main>Loaded</main>":payloads[path];
    return {ok:value!==undefined,json:async()=>value,text:async()=>String(value)};
  };
  runInNewContext(loader,{window,document,fetch,URL,CustomEvent:class{constructor(public type:string,public init?:unknown){}},console});
  await window.OaaSPageReady;
  await window.OaaSPageScriptsReady;
  assert.equal(mounted.innerHTML,"<main>Loaded</main>");
  assert.equal(document.title,"Discovery");
  assert.deepEqual(scriptUrls,["https://example.test/runtime/discovery.js"]);
});
