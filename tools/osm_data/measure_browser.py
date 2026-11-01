"""Measure selection against a running preview (POLKU_URL), never route or query Overpass.

POLKU_URL=http://127.0.0.1:8796/ python tools/osm_data/measure_browser.py > measurements.json
The phone case is Chrome emulation: 4x CPU, 80 ms latency, 10 Mbit/s download.
"""
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
    'Kilpisjarvi north': [20.8, 69.05],
    'Tykkikallio Jyvaskyla': [25.7656, 62.2306],
}

SCRIPT = """(async () => {
 const W = await import('/js/ways.js'), G = await import('/js/geo.js'), calls = [], real = window.fetch;
 window.fetch = async (input, init) => {
   const url = String(input);
   if (/overpass|maps.mail.ru/.test(url)) throw new Error('Selection tried public Overpass');
   const res = await real(input, init);
   if (url.includes('/__osm/')) calls.push({url, range:init?.headers?.Range, bytes:+res.headers.get('Content-Length')});
   return res;
 };
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
     out.push({name,ll,tapped,cold_ms,repeat_ms,requests:network.length,bytes:network.reduce((s,r)=>s+r.bytes,0),network,...pick});
   }
   return out;
 } finally { window.fetch = real; }
})()"""


def main():
    chrome = Chrome()
    result = {'browser': chrome.send('Browser.getVersion'), 'origin': BASE, 'cases': {}}
    try:
        for label, width, height, phone in [('desktop', 1440, 900, False), ('phone_emulated', 390, 844, True)]:
            page = chrome.page(width, height, phone)
            try:
                chrome.send('Storage.clearDataForOrigin', {'origin': BASE.rstrip('/'), 'storageTypes': 'indexeddb,cache_storage'}, page.s)
                chrome.send('Page.addScriptToEvaluateOnNewDocument', {'source': EMPTY_DEPTHS + WX_FIXED}, page.s)
                page.open_app({'activity': 'mtb', 'layers': {'trails': False, 'uphill': False, 'wx': False}})
                if phone:
                    chrome.send('Emulation.setCPUThrottlingRate', {'rate': 4}, page.s)
                    chrome.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 80,
                                'downloadThroughput': 1250000, 'uploadThroughput': 625000}, page.s)
                data = page.js(SCRIPT.replace('SAMPLES', json.dumps(SAMPLES)), timeout=180000)
                assert len(data) == len(SAMPLES) and all(row['pieces'] and row['metres'] > 0 for row in data)
                assert all(not stop.get('unloaded') for row in data for stop in row['stops'].values()), 'selection ended on missing data'
                result['cases'][label] = data
            finally:
                page.close()
    finally:
        chrome.close()
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
