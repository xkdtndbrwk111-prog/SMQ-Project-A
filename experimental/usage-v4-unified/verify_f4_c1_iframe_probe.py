"""C1 feasibility probe (real Chromium, persistent profile). Mimics the GAS HtmlService nesting:
top page (site A: 127.0.0.1) -> sandboxed iframe (site B: localhost) -> nested same-origin iframe (user HTML).
The user frame: IndexedDB write/read, crypto.subtle SHA-256, fetch() of a PINNED raw.githubusercontent.com file.
Runs: 1) fresh write  2) reload  3) browser closed + relaunched on the same profile  4) sandbox WITHOUT allow-same-origin."""
import asyncio, json, sys, threading, http.server, functools, shutil, tempfile
from playwright.async_api import async_playwright
SANDBOX = 'allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation'
RAW = 'https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/9573f91d2845a9667e2540df051f499d937dd94a/README.md'
INNER = """<!doctype html><script>(async()=>{const r={origin:location.origin,isSecure:isSecureContext};
try{const db=await new Promise((ok,no)=>{const q=indexedDB.open('hoja-probe',1);q.onupgradeneeded=()=>q.result.createObjectStore('k');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});
 const get=k=>new Promise((ok,no)=>{const t=db.transaction('k').objectStore('k').get(k);t.onsuccess=()=>ok(t.result);t.onerror=()=>no(t.error)});
 r.before=await get('v')||null;
 if(location.hash==='#write'){await new Promise((ok,no)=>{const t=db.transaction('k','readwrite');t.objectStore('k').put({at:Date.now(),n:(r.before?.n||0)+1},'v');t.oncomplete=ok;t.onerror=()=>no(t.error)});}
 r.after=await get('v')||null;r.idb='OK';}catch(e){r.idb='ERR '+e.name}
try{r.persisted=await navigator.storage?.persisted?.();const e=await navigator.storage?.estimate?.();r.quotaMB=e?Math.round(e.quota/1048576):null}catch(e){r.storageApi='ERR '+e.name}
try{const t0=performance.now();const res=await fetch(%RAW%,{cache:'default',credentials:'omit'});const b=await res.arrayBuffer();
 const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
 r.fetch={status:res.status,bytes:b.byteLength,sha256:h.slice(0,16),ms:Math.round(performance.now()-t0)};}catch(e){r.fetch='ERR '+e.name+' '+e.message}
parent.parent.postMessage({probe:r},'*');})();</script>"""
OUTER = '<!doctype html><iframe id=u src="inner.html%HASH%"></iframe>'
TOP = '<!doctype html><script>addEventListener("message",e=>{if(e.data&&e.data.probe)document.title=JSON.stringify(e.data.probe)})</script><iframe sandbox="%SB%" src="http://localhost:%P2%/outer.html"></iframe>'
def serve(port, files):
    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            p = self.path.split('?')[0].split('#')[0].lstrip('/')
            body = files.get(p)
            if body is None: self.send_response(404); self.end_headers(); return
            self.send_response(200); self.send_header('content-type', 'text/html; charset=utf-8'); self.end_headers(); self.wfile.write(body.encode())
        def log_message(self, *a): pass
    s = http.server.ThreadingHTTPServer(('127.0.0.1', port), H); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
async def run_once(pw, prof, hash_, sb):
    files_b['outer.html'] = OUTER.replace('%HASH%', hash_)
    files_a['top.html'] = TOP.replace('%SB%', sb).replace('%P2%', str(P2))
    ctx = await pw.chromium.launch_persistent_context(prof, headless=True)
    page = ctx.pages[0] if ctx.pages else await ctx.new_page()
    await page.goto(f'http://127.0.0.1:{P1}/top.html'); await page.wait_for_function('document.title.startsWith("{")', timeout=30000)
    r1 = json.loads(await page.title())
    out = [r1]
    if hash_ == '#write':
        files_b['outer.html'] = OUTER.replace('%HASH%', '#read')
        await page.evaluate('document.title=""'); await page.reload(); await page.wait_for_function('document.title.startsWith("{")', timeout=30000)
        out.append(json.loads(await page.title()))
    await ctx.close(); return out
P1, P2 = 8781, 8782
files_a, files_b = {}, {'inner.html': INNER.replace('%RAW%', json.dumps(RAW))}
async def main():
    serve(P1, files_a); serve(P2, files_b)
    prof = tempfile.mkdtemp(prefix='hoja-c1-')
    res = {}
    async with async_playwright() as pw:
        a = await run_once(pw, prof, '#write', SANDBOX); res['1_fresh_write'] = a[0]; res['2_after_reload'] = a[1]
        b = await run_once(pw, prof, '#read', SANDBOX); res['3_after_browser_restart'] = b[0]
        c = await run_once(pw, tempfile.mkdtemp(prefix='hoja-c1n-'), '#write', SANDBOX.replace('allow-same-origin ', '')); res['4_sandbox_without_allow_same_origin'] = c[0]
    shutil.rmtree(prof, ignore_errors=True)
    print(json.dumps(res, indent=1, ensure_ascii=False))
asyncio.run(main())
