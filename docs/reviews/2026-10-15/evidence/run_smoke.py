import os, sys, subprocess, runpy, json, time
from pathlib import Path

repo, mode, profile, log, *groups = sys.argv[1:]
os.chdir(repo)
os.environ['POLKU_CHROME'] = '/usr/bin/chromium'
os.environ['POLKU_CHROME_PROFILE'] = profile
sys.path.insert(0, str(Path(repo) / 'tools'))
original = subprocess.Popen
extra = ['--no-sandbox', '--proxy-server=' + os.environ['HTTPS_PROXY'], '--proxy-bypass-list=localhost;127.0.0.1']
if mode == 'validated':
    extra += ['--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
def launch(args, *a, **kw):
    if isinstance(args, list) and args[0] == '/usr/bin/chromium':
        args = args + extra
    return original(args, *a, **kw)
subprocess.Popen = launch
if mode == 'screencast':
    # Diagnostic transport only: keep the headless compositor producing real
    # frames. Source files, DOM, timers and assertions are unchanged.
    import cdp
    old_recv=cdp.Chrome._recv
    old_page=cdp.Page.__init__
    def receive(self,timeout=90):
        while True:
            message=old_recv(self,timeout)
            if message.get('method')=='Page.screencastFrame':
                ack={'id':-1,'method':'Page.screencastFrameAck','sessionId':message['sessionId'],'params':{'sessionId':message['params']['sessionId']}}
                os.write(self.w,json.dumps(ack).encode()+b'\0')
                continue
            if message.get('id')==-1:continue
            return message
    def page_init(self,*args,**kw):
        old_page(self,*args,**kw)
        self.c.send('Page.startScreencast',{'format':'jpeg','quality':10,'maxWidth':32,'maxHeight':32,'everyNthFrame':1},self.s)
    cdp.Chrome._recv=receive
    cdp.Page.__init__=page_init
class Tee:
    def __init__(self, stream, file): self.stream, self.file = stream, file
    def write(self, text): self.stream.write(text); self.file.write(text); self.file.flush()
    def flush(self): self.stream.flush(); self.file.flush()
out = open(log, 'w')
sys.stdout = Tee(sys.stdout, out)
sys.stderr = Tee(sys.stderr, out)
print(json.dumps({'repo':repo,'commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'mode':mode,'extra_flags':extra,'profile':profile,'groups':groups or 'all 20','python':sys.version.split()[0],'chromium':subprocess.check_output(['/usr/bin/chromium','--version'],text=True).strip()}), flush=True)
start = time.monotonic()
sys.argv = ['tools/smoke.py', *groups]
try:
    runpy.run_path('tools/smoke.py',run_name='__main__')
finally:
    print(json.dumps({'elapsed_s':round(time.monotonic()-start,2)}),flush=True)
