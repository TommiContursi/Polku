"""Measure selection against a running preview (POLKU_URL), never route or query Overpass.

POLKU_URL=http://127.0.0.1:8796/ python tools/osm_data/measure_browser.py > measurements.json
The phone case is Chrome emulation: 4x CPU, 80 ms latency, 10 Mbit/s download.
"""
import argparse
from contextlib import redirect_stdout
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cdp import BASE, Chrome
from smoke import EMPTY_DEPTHS, WX_FIXED

SAMPLES = {
    'Helsinki': [24.9384, 60.1699],
    'Rural central Finland': [25.5, 62.2],
    'Nuuksio forest': [24.5, 60.3],
    'Turku coast': [22.25, 60.45],
    'Rovaniementie north': [27.3921157, 68.3992993],
    'Tykkikallio Jyvaskyla': [25.7656, 62.2306],
}

COUNTRY_SAMPLES = {
    'finland': SAMPLES,
    'sweden': {'Stockholm':[18.0686,59.3293],'Gothenburg coast':[11.9746,57.7089],'Kiruna north':[20.225,67.855]},
    'norway': {'Oslo':[10.7522,59.9139],'Bergen coast':[5.3221,60.393],'Tromso north':[18.9553,69.6492],'Oslomarka forest':[10.68,60.0]},
    'estonia': {'Tallinn':[24.7536,59.437],'Tartu':[26.7251,58.3776],'Lahemaa forest':[25.97,59.57]},
}

SCRIPT = """(async () => {
 const W = await import('/js/ways.js'), L = await import('/js/lit.js'), G = await import('/js/geo.js'), calls = [], real = window.fetch;
 const I = await import('/js/inspect.js'), T = await import('/js/trails.js'), V = await import('/js/winter.js'), H = await import('/js/waterdata.js'), S = await import('/js/stops.js');
 T.holdFetches(false); V.holdWinterFetches(false); H.seedWater(null);
 let publicCalls=0;
 const { OSM_DATA_MANIFEST } = await import('/js/config.js'), dataRoot = new URL('.', OSM_DATA_MANIFEST).href;
 window.fetch = async (input, init) => {
   const url = String(input);
   if (/overpass|maps.mail.ru/.test(url)) { publicCalls++; throw new DOMException('Unexpected public Overpass','AbortError'); }
   if (/lipas|vayla|kartta.liikennevirasto/.test(url)) throw new DOMException('Independent provider excluded from OSM measurement','AbortError');
   const res = await real(input, init);
   if (url.startsWith(dataRoot)) calls.push({url, range:init?.headers?.Range, bytes:+res.headers.get('Content-Length')});
   return res;
 };
 const { StaticOSM } = await import('/js/osm-data.js');
 const products = Object.entries({trails:13,winter:12,hazards:11,places:12,inspection:14}).map(([name,z])=>({name,z,reader:new StaticOSM(OSM_DATA_MANIFEST,name,z)}));
 const out = [];
 try {
   for (const [name,ll] of Object.entries(SAMPLES)) {
     let seed, tapped;
     const select = async () => {
       await W.loadWays(W.wayTile(ll));
       seed ||= W.nearestWay(ll, 2000);
       if (!seed) throw new Error(name + ': no way');
       if (!tapped) {
         const segment = seed.coords.slice(1).map((b,i)=>({a:seed.coords[i],b,d:G.pointSegment(ll,seed.coords[i],b).d})).sort((a,b)=>a.d-b.d)[0];
         tapped = segment.a.map((v,i)=>(v+segment.b[i])/2);
       }
       const pick = await W.joinWay(seed,tapped);
       return {seed:seed.id, pieces:pick.chain.length, metres:pick.chain.reduce((s,p)=>s+p.w.len,0), stops:pick.stops};
     };
     let at = performance.now(), begin = calls.length;
     const pick = await select(), cold_ms = performance.now()-at;
     const network = calls.slice(begin);
     at = performance.now(); begin = calls.length;
     const again = await select(), repeat_ms = performance.now()-at;
     if (JSON.stringify(pick) !== JSON.stringify(again) || calls.length !== begin) throw new Error(JSON.stringify({name,pick,again,newCalls:calls.slice(begin)}));
     at=performance.now(); begin=calls.length;
     const tags=await I.osmDetails({type:'way',id:pick.seed,ll:tapped});
     if (tags?.id!==pick.seed || !tags.tags.highway || calls.slice(begin).some(c=>c.url.includes('inspection.pmtiles'))) throw new Error(name+': selected-way tags did not reuse raw ways');
     const full_tags={ms:performance.now()-at,requests:calls.length-begin,bytes:calls.slice(begin).reduce((s,r)=>s+r.bytes,0)};
     const xy = G.lonLatToTile(...ll, L.LIT_Z).map(Math.floor);
     at = performance.now(); begin = calls.length;
     const lit = await L.litTile(...xy), lit_ms = performance.now()-at, litNetwork = calls.slice(begin);
     at = performance.now(); begin = calls.length;
     const litAgain = await L.litTile(...xy), lit_repeat_ms = performance.now()-at;
     if (JSON.stringify(lit) !== JSON.stringify(litAgain) || calls.length !== begin) throw new Error(name + ': repeat lighting downloads again');
     if (!out.length && (await new StaticOSM(OSM_DATA_MANIFEST).ready()).manifest.datasets.geometry) products.push({name:'geometry',z:13,reader:new StaticOSM(OSM_DATA_MANIFEST,'geometry',13)});
     const details = {};
     for (const {name:product,z,reader} of products) {
       const tile = G.lonLatToTile(...ll,z).map(Math.floor);
       at = performance.now(); begin = calls.length;
       const first = await reader.tile(tile), ms = performance.now()-at, requests = calls.slice(begin);
       at = performance.now(); begin = calls.length;
       const repeat = await reader.tile(tile), repeat_ms = performance.now()-at;
       if (JSON.stringify(first)!==JSON.stringify(repeat) || calls.length!==begin) throw new Error(name+': '+product+' cache not reused');
       if (product==='geometry' && (first.schema!==2 || first.areas_complete!==true || first.nearby_complete!==true)) throw new Error(name+': incomplete shared geometry');
       details[product]={source:first.source,cold_ms:ms,repeat_ms,elements:first.elements.length,requests:requests.length,bytes:requests.reduce((s,r)=>s+r.bytes,0),network:requests};
     }
     const trail=await T.trailTile(...G.lonLatToTile(...ll,13).map(Math.floor)), winter=await V.winterTile(...G.lonLatToTile(...ll,12).map(Math.floor));
     const water=await H.waterInputs([ll[0]-.0001,ll[1]-.0001,ll[0]+.0001,ll[1]+.0001],{hazards:true}), stays=await S.staysNear(ll,0.1);
     if ([trail,winter].some(j=>j.source?.provider!=='Polku OSM data') || water.missing.includes('OpenStreetMap') || publicCalls) throw new Error(name+': a real consumer did not use hosted data');
     const consumers={trail_ways:trail.w.length,winter_ways:winter.w.length,hazards:water.hazards.features.length,stays:stays.length,overpass_requests:publicCalls};
     out.push({full_tags,consumers,details,name,ll,tapped,cold_ms,repeat_ms,requests:network.length,bytes:network.reduce((s,r)=>s+r.bytes,0),network,...pick,
       lighting:{cold_ms:lit_ms,repeat_ms:lit_repeat_ms,ways:lit.w.length,requests:litNetwork.length,bytes:litNetwork.reduce((s,r)=>s+r.bytes,0),network:litNetwork}});
   }
   return out;
 } finally { window.fetch = real; }
})()"""

BORDER_SCRIPT = """(async()=>{
 const {StaticOSM}=await import('/js/osm-data.js'), {OSM_DATA_MANIFEST}=await import('/js/config.js'), {lonLatToTile}=await import('/js/geo.js');
 const readers=Object.entries({ways:14,lit:13,trails:13,winter:12,hazards:11,places:12,inspection:14}).map(([name,z])=>({name,z,reader:new StaticOSM(OSM_DATA_MANIFEST,name,z)}));
 const out={}, calls=[], real=window.fetch, root=new URL('.',OSM_DATA_MANIFEST).href;
 let publicCalls=0;
 window.fetch=async(input,init)=>{
  const url=String(input);
  if (/overpass|maps.mail.ru/.test(url)) {publicCalls++;throw new DOMException('Unexpected border Overpass','AbortError');}
  const res=await real(input,init);
  if(url.startsWith(root)) calls.push({url,range:init?.headers?.Range,bytes:+res.headers.get('Content-Length')});
  return res;
 };
 try {
 for(const [name,ll] of Object.entries({'Tornio-Haparanda':[24.14,65.84],'Kilpisjarvi':[20.7945,69.045],'Svinesund':[11.22,59.10],'Narva':[28.1903,59.3772],'Outside control':[30,58]})) {
  const row={};
  for(const {name:kind,z,reader} of readers) {
   const xy=lonLatToTile(...ll,z).map(Math.floor), start=performance.now(), begin=calls.length;
   try {
    const j=await reader.tile(xy), cold_ms=performance.now()-start, network=calls.slice(begin), at=performance.now(), count=calls.length;
    const again=await reader.tile(xy), repeat_ms=performance.now()-at;
    if(JSON.stringify(j)!==JSON.stringify(again) || calls.length!==count) throw new Error(name+': repeated border tile changed/downloaded again');
    row[kind]={hosted:true,elements:j.elements.length,source:j.source,cold_ms,repeat_ms,bytes:network.reduce((s,r)=>s+r.bytes,0),network};
   }
   catch(e) { if(!/Outside static OSM coverage/.test(e.message)) throw e; row[kind]={hosted:false,fallback:'coverage'}; }
  }
  if(['Tornio-Haparanda','Svinesund'].includes(name)) {
   if(Object.values(row).some(r=>!r.hosted)) throw new Error(name+': a jointly covered product still falls back');
   const T=await import('/js/trails.js'), V=await import('/js/winter.js'), L=await import('/js/lit.js'), H=await import('/js/waterdata.js'), S=await import('/js/stops.js'), W=await import('/js/ways.js'), I=await import('/js/inspect.js');
   await W.loadWays(W.wayTile(ll));
   const seed=W.nearestWay(ll,2000);
   if(!seed) throw new Error(name+': no selectable border way');
   const pick=await W.joinWay(seed,ll), atTags=calls.length, tags=await I.osmDetails({type:'way',id:seed.id,ll}), tagRequests=calls.length-atTags;
   if(Object.values(pick.stops).some(s=>s.unloaded) || tags?.id!==seed.id || tagRequests) throw new Error(name+': border selection/tag reuse incomplete');
   const trail=await T.trailTile(...lonLatToTile(...ll,13).map(Math.floor)), winter=await V.winterTile(...lonLatToTile(...ll,12).map(Math.floor)), lit=await L.litTile(...lonLatToTile(...ll,13).map(Math.floor));
   const water=await H.waterInputs([ll[0]-.0001,ll[1]-.0001,ll[0]+.0001,ll[1]+.0001],{hazards:true}), stays=await S.staysNear(ll,.1);
   if([trail,winter,lit].some(j=>j.source?.provider!=='Polku OSM data') || water.missing.includes('OpenStreetMap') || publicCalls) throw new Error(name+': real border consumer did not use hosted data');
   row.consumers={selected_way:seed.id,selected_pieces:pick.chain.length,tag_requests:tagRequests,trail_ways:trail.w.length,winter_ways:winter.w.length,lit_ways:lit.w.length,hazards:water.hazards.features.length,stays:stays.length,overpass_requests:publicCalls};
  }
  out[name]=row;
 }
 if(Object.values(out['Outside control']).some(r=>r.hosted) || ['lit','trails','winter','hazards','places'].some(k=>out.Narva[k].hosted)) throw new Error('Genuine border gap claimed as covered');
 return out;
 } finally {window.fetch=real;}
})()"""


GEOMETRY_SCRIPT = """(async()=>{
 const {StaticOSM}=await import('/js/osm-data.js'), {OSM_DATA_MANIFEST}=await import('/js/config.js'), {lonLatToTile}=await import('/js/geo.js'), {containsArea}=await import('/js/osm-geometry.js');
 if (!(await new StaticOSM(OSM_DATA_MANIFEST).ready()).manifest.datasets.geometry) return [];
 const reader=new StaticOSM(OSM_DATA_MANIFEST,'geometry',13), out=[], calls=[], real=window.fetch, root=new URL('.',OSM_DATA_MANIFEST).href;
 window.fetch=async (url,init)=>{
  if (/overpass|maps.mail.ru/.test(String(url))) throw new DOMException('Unexpected public Overpass','AbortError');
  const res=await real(url,init);
  if(String(url).startsWith(root))calls.push({url:String(url),range:init?.headers?.Range,bytes:+res.headers.get('Content-Length')});
  return res;
 };
 try {
  for(const [name,ll,id] of [['Inari',[27.7,68.95],402543],['Saimaa',[29.68505859375,61.928610725008284],7379046],['Vattern',[14.5,58.2],null],['Sognsvann',[10.73,59.974],null],['Ulemiste',[24.76,59.39],967594],['Kadrioru park',[24.79,59.44],9259639]]) {
   const xy=lonLatToTile(...ll,13).map(Math.floor), start=performance.now(), begin=calls.length, j=await reader.tile(xy), cold_ms=performance.now()-start;
   if(!j.areas_complete || !j.nearby_complete)throw new Error(name+': unlocated geometry');
   const matches=j.elements.filter(e=>e.area?.complete && containsArea(e,j.tile,ll));
   if(!matches.some(e=>id ? e.id===id : e.tags.natural==='water'))throw new Error(name+': original lake/park area not found');
   const count=calls.length, repeat=performance.now();await reader.tile(xy);
   if(calls.length!==count)throw new Error(name+': geometry repeat downloads again');
   out.push({name,ll,complete:true,source:j.source,matches:matches.map(e=>({type:e.type,id:e.id,name:e.tags.name})),cold_ms,repeat_ms:performance.now()-repeat,network:calls.slice(begin)});
  }
  return out;
 } finally {window.fetch=real;}
})()"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--country',choices=[*COUNTRY_SAMPLES,'all'],default='finland')
    args=parser.parse_args()
    samples=COUNTRY_SAMPLES[args.country] if args.country!='all' else {name:ll for cases in COUNTRY_SAMPLES.values() for name,ll in cases.items()}
    output = sys.stdout
    with redirect_stdout(sys.stderr):
        print('OSM measurement: starting Chrome', flush=True)
        chrome = Chrome()
        result = {'browser': chrome.send('Browser.getVersion'), 'origin': BASE, 'cases': {}, 'border_checks': {}, 'geometry_checks': {}}
        try:
            for label, width, height, phone in [('desktop', 1440, 900, False), ('phone_emulated', 390, 844, True)]:
                print(f'OSM measurement: {label} starting', flush=True)
                page = chrome.page(width, height, phone)
                try:
                    chrome.send('Storage.clearDataForOrigin', {'origin': BASE.rstrip('/'), 'storageTypes': 'indexeddb,cache_storage'}, page.s)
                    chrome.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS + WX_FIXED}, page.s)
                    print(f'OSM measurement: {label} opening app', flush=True)
                    page.open_app({'activity': 'mtb', 'layers': {'trails': False, 'uphill': False, 'wx': False}})
                    print(f'OSM measurement: {label} app ready; querying consumers', flush=True)
                    chrome.send('Network.setCacheDisabled', {'cacheDisabled': True}, page.s)
                    if phone:
                        chrome.send('Emulation.setCPUThrottlingRate', {'rate': 4}, page.s)
                        chrome.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 80,
                                    'downloadThroughput': 1250000, 'uploadThroughput': 625000}, page.s)
                    data = page.js(SCRIPT.replace('SAMPLES', json.dumps(samples)), timeout=180000)
                    assert len(data) == len(samples) and all(row['pieces'] and row['metres'] > 0 for row in data)
                    assert data[0]['requests'] > 0 and data[0]['bytes'] > 0, 'cold source requests were not measured'
                    assert all(not stop.get('unloaded') for row in data for stop in row['stops'].values()), 'selection ended on missing data'
                    result['cases'][label] = data
                    print(f'OSM measurement: {label} {len(data)} covered locations complete', flush=True)
                    if args.country=='all':
                        result['geometry_checks'][label]=page.js(GEOMETRY_SCRIPT,timeout=90000)
                        result['border_checks'][label]=page.js(BORDER_SCRIPT,timeout=180000)
                        print(f'OSM measurement: {label} border controls complete', flush=True)
                finally:
                    page.close()
        finally:
            chrome.close()
        print(json.dumps(result, indent=2), file=output)


if __name__ == '__main__':
    main()
