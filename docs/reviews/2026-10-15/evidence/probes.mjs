import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
const repo=path.resolve(process.argv[2]);
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.fetch=async()=>{throw new Error('No real network allowed in probes');};
const results=[];
const record=(name,evidence)=>{const row={name,...evidence};results.push(row);console.log(JSON.stringify(row));};

// Load unchanged source text. Only dependencies/browser services are replaced.
async function load(file, overrides={}, globals={}) {
  const data=new Map();
  const context=vm.createContext({console,Response,Request,URL,URLSearchParams,AbortController,DOMException,setTimeout,clearTimeout,performance,structuredClone,localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{onLine:true},fetch:async()=>{throw new Error('No real network allowed');},...globals});
  function get(id) {
    if(data.has(id)) return data.get(id);
    let m;
    if(overrides[id]) {
      const obj=overrides[id];
      m=new vm.SyntheticModule(Object.keys(obj),function(){for(const [key,value] of Object.entries(obj)) this.setExport(key,value);},{context,identifier:id});
    } else m=new vm.SourceTextModule(fs.readFileSync(id,'utf8'),{context,identifier:id});
    data.set(id,m);return m;
  }
  const root=get(path.join(repo,file));
  await root.link((specifier,from)=>get(path.resolve(path.dirname(from.identifier),specifier)));
  await root.evaluate();return root.namespace;
}
for(const [source,n] of [['valhalla',3],['brouter',8]]) {
  const sent=[];
  const net=await load('js/net.js',{}, {fetch:async()=>{sent.push(performance.now());return new Response('{}');}});
  await Promise.all(Array.from({length:n},()=>net.request(source,'https://mock.invalid')));
  record('parallel pacing '+source,{calls:sent.length,spreadMs:+(sent.at(-1)-sent[0]).toFixed(2)});
}
{
 const sent=[];const net=await load('js/net.js',{}, {fetch:async()=>{sent.push(performance.now());return new Response('{}');}});
 await net.request('valhalla','https://mock.invalid');await net.request('valhalla','https://mock.invalid');
 record('sequential pacing control',{calls:sent.length,gapMs:Math.round(sent[1]-sent[0])});
}
{
 let calls=0;
 const router=await load('js/router.js',{[path.join(repo,'js/water.js')]:{routeWater:async()=>({coords:[[24,60],[24.01,60.01]],tags:[{}],portage:[],water:{missing:++calls===1?['OpenStreetMap']:[]}})}});
 const args={from:[24,60],to:[24.01,60.01],mode:'water',profile:'',opts:{water:{at:1}}};
 const first=await router.routeLeg(args);const retry=await router.routeLeg(args);
 const changed=await router.routeLeg({...args,to:[24.011,60.01]});
 record('incomplete water cache',{callsAfterRetryAndChangedKey:calls,retrySameObject:first===retry,retryMissing:retry.water.missing,changedKeyMissing:changed.water.missing});
}
{
 let onlineCalls=0;
 const cache={match:async key=>key==='/__polku/offline-preview'?undefined:new Response('saved-working-app'),put:async()=>{}};
 const c=vm.createContext({Response,Request,URL,setTimeout,clearTimeout,navigator:{onLine:true},location:{origin:'https://polku.si'},self:{addEventListener:()=>{}},caches:{open:async()=>cache},fetch:async()=>{onlineCalls++;return new Response('server error',{status:503});}});
 vm.runInContext(fs.readFileSync(path.join(repo,'sw.js'),'utf8'),c);
 const r=await vm.runInContext("networkFirst(new Request('https://polku.si/js/main.js'),'https://polku.si/js/main.js',1)",c);
 record('cached shell HTTP 503',{status:r.status,body:await r.text()});
 c.fetch=async()=>{throw new Error('offline');};
 const control=await vm.runInContext("networkFirst(new Request('https://polku.si/js/main.js'),'https://polku.si/js/main.js',1)",c);
 record('cached shell network rejection control',{status:control.status,body:await control.text()});
 vm.runInContext('preview=Promise.resolve(true);previewNow=true;',c);
 cache.match=async()=>undefined;c.fetch=async()=>{onlineCalls++;return new Response('network-only module');};
 const before=onlineCalls;
 const p=await vm.runInContext("networkFirst(new Request('https://polku.si/js/missing.js'),'https://polku.si/js/missing.js',1)",c);
 record('offline preview missing module',{networkCalls:onlineCalls-before,body:await p.text()});
}
const ui=await import(pathToFileURL(path.join(repo,'js/ui.js')));
const weather=await import(pathToFileURL(path.join(repo,'js/weather.js')));
let pending=new Map(),seen=new Set();
const windAlong=async(pts,along,tAt,start)=>{
 if(!seen.has(start)){seen.add(start);return new Promise(resolve=>pending.set(start,resolve));}
 return {head:[],marker:start};
};
const {Planner}=await load('js/planner.js',{
 [path.join(repo,'js/weather.js')]:{...weather,windAlong},
 [path.join(repo,'js/ui.js')]:{...ui,toast:()=>{}}
});
{
 let departure=1;const a={pts:[],along:[],tAt:[]};const p=Object.create(Planner.prototype);
 Object.assign(p,{analysis:a,timeOpt:()=>({}),startSec:()=>departure,darkWarnings:()=>[],snowOf:()=>null,timed:()=>({total:1,tAt:[],waits:[]}),setSnow:()=>{},renderAnalysis:()=>{},loadHazards:()=>{}});
 const old=p.loadWind(a);departure=2;const newer=p.loadWind(a);
 pending.get(2)({head:[],marker:2});await newer;const afterNew=a.wind.startSec;
 pending.get(1)({head:[],marker:1});await old;
 record('weather completion order',{afterNew,afterOld:a.wind.startSec,currentDeparture:departure});
}
{
 let sport='mtb';const p=Object.create(Planner.prototype);
 Object.assign(p,{app:{activity:()=>sport},points:[[24.94,60.17],[24.95,60.18]],legs:[{mode:'auto'}],style:{p:'flowy',v:{},wet:'auto'},wet:{on:false},nogos:[],loop:{open:false},panel:{classList:{toggle:()=>{}}},renderQuickSport:()=>{},setMode:()=>{},renderToolbarState:()=>{},update:()=>{},pchange:new WeakMap(),pstop:new WeakMap(),pcarry:new WeakMap()});
 const before=p.legKey(0).key;sport='paddle';p.onActivityChange('mtb');
 record('map sport vs shared route style',{routeSport:p.legSport(0),styleAfter:p.styleOf('mtb').p,keyChanged:before!==p.legKey(0).key});
 const q=Object.create(Planner.prototype);Object.assign(q,{app:{activity:()=> 'mtb'},points:[[24.94,60.17],[24.95,60.18]],legs:[{mode:'auto'}],style:{p:'balanced',v:{},wet:'auto'},pchange:new WeakMap(),pstop:new WeakMap(),pcarry:new WeakMap(),nogos:[{ll:[24.945,60.175],r:50}]});
 const shared=await load('js/planner.js',{}, {location:{href:'https://polku.si/'}});
 const url=shared.Planner.prototype.shareUrl.call(q);
 record('Avoid serialization',{localAvoidCount:q.nogos.length,url,decoded:shared.parseShared(new URL(url).searchParams)});
}
{
 const {analyse}=await load('js/analysis.js');
 const a=await analyse({coords:[[24.94,60.17],[24.941,60.171]],attrs:[{sport:'hike',mode:'auto',tags:{highway:'path'}}]},{activity:'hike',craft:'kayak'});
 record('missing terrain',{distance:a.total,time:String(a.time),minElevation:String(a.minE),maxElevation:String(a.maxE),ascent:a.up});
}
fs.writeFileSync(process.argv[3],JSON.stringify({repo,results},null,2)+'\n');
process.exit(0);
