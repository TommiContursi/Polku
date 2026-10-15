import os,sys,subprocess,json,time
from pathlib import Path
repo, mode, profile, base, log=sys.argv[1:]
os.environ.update(POLKU_CHROME='/usr/bin/chromium',POLKU_CHROME_PROFILE=profile,POLKU_URL=base)
sys.path.insert(0,str(Path(repo)/'tools'))
import cdp
original=subprocess.Popen
def launch(args,*a,**kw):
 if isinstance(args,list) and args[0]=='/usr/bin/chromium':
  args=args+['--no-sandbox','--proxy-server='+os.environ['HTTPS_PROXY'],'--proxy-bypass-list=localhost;127.0.0.1']
  if mode=='validated':args+=['--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']
 return original(args,*a,**kw)
subprocess.Popen=launch
rows=[]
def record(x):rows.append(x);print(json.dumps(x),flush=True)
c=cdp.Chrome()
try:
 p=c.page(390,844,True)
 p.open_app({'activity':'mtb','trailsByActivity':{'mtb':{'trailDetails':False}}},{'polku:plannerDock':'"left"'})
 p.js("import('/js/trails.js').then(T=>T.holdFetches())")
 record(p.js("(()=>{let n=0;const f=()=>{window.auditFrames=++n;requestAnimationFrame(f)};requestAnimationFrame(f);return {test:'page',visibility:document.visibilityState,hidden:document.hidden,userAgent:navigator.userAgent,viewport:document.querySelector('meta[name=viewport]').content}})()"))
 p.js("(()=>{const p=polku.planner;p.setActive(true);p.setMode('line');p.addPoint([23.80,61.509]);p.addPoint([23.817,61.519]);return true})()")
 p.js("new Promise(r=>setTimeout(r,3000))")
 for phase in ['ordinary','foreground','captured-frame']:
  if phase=='foreground':c.send('Page.bringToFront',{},p.s)
  for st in ['peek','profile','half','full']:
   p.js('polku.planner.setSheetState('+json.dumps(st)+',{remember:false});true')
   time.sleep(1)
   if phase=='captured-frame':c.send('Page.captureScreenshot',{'format':'png'},p.s)
   record(p.js("(()=>{const p=polku.planner,r=p.panel.getBoundingClientRect(),x=document.querySelector('.map-ctrls').getBoundingClientRect();return {test:'layout',phase:"+json.dumps(phase)+",state:p.panel.dataset.state,height:r.height,top:r.top,controlBottom:x.bottom,visibility:document.visibilityState,frames:window.auditFrames||0}})()"))
  p.js("polku.planner.setTab('route');true")
  p.js("document.querySelector('#btn-time').click();true")
  time.sleep(.15)
  if phase=='captured-frame':c.send('Page.captureScreenshot',{'format':'png'},p.s)
  record(p.js("({test:'weather-highlight',phase:"+json.dumps(phase)+",flash:polku.planner.sec.depart.el.classList.contains('sec-flash'),tab:polku.planner.tab,visibility:document.visibilityState,frames:window.auditFrames||0})"))
 p.js("polku.planner.reveal('points');true")
 p.errors()
 record(p.js("(()=>{const p=polku.planner,b=[...p.panel.querySelectorAll('button')].find(b=>b.textContent.includes('Back to start'));const before=p.points.length;b.click();return {test:'Back to start button',before,after:p.points.length,loopType:typeof p.loop}})()"))
 record({'test':'Back to start exceptions','errors':p.errors()})
 record(p.js("(()=>{const p=polku.planner;p.nogos=[{ll:[23.81,61.514],r:50}];return {test:'Avoid share',localAvoid:p.nogos.length,url:p.shareUrl()}})()"))
 record(p.js("(()=>{const el=polku.planner.panel;let prevented=null;const observe=e=>{prevented=e.defaultPrevented};document.addEventListener('wheel',observe,{once:true});el.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true}));return {test:'panel magnification policy',ctrlWheelPrevented:prevented,viewport:document.querySelector('meta[name=viewport]').content,scale:visualViewport.scale}})()"))
finally:
 c.close()
 Path(log).write_text(json.dumps(rows,indent=2)+'\n')
