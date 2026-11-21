// Local classroom preview only; requires demo Auth + Firestore emulators.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../phase3b2/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
import {createLocalService} from '../phase3b2/service.mjs';
import {assertReady,PROJECT} from '../phase3b2/isolation.mjs';
await assertReady();
const root=fileURLToPath(new URL('../../',import.meta.url));
const kind=process.env.HOJA_CLASS_BUILD||'production';if(!['production','test'].includes(kind))throw Error('INVALID_BUILD');
const dist=path.join(root,kind==='test'?'dist-current-test':'dist-current');
const port=Number(process.env.HOJA_CLASS_PORT||8767);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
const host=process.env.HOJA_CLASS_HOST||'127.0.0.1';
if(!/^(127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host))throw Error('PRIVATE_HOST_REQUIRED');
const origin=`http://${host}:${port}`;
const service=await createLocalService(),app=initializeApp({projectId:PROJECT},'class-preview-'+randomUUID()),auth=getAuth(app);
const teacherSecret=randomBytes(24).toString('base64url'),sessions=new Map();
const u=await auth.createUser({email:`teacher-${randomUUID()}@example.test`,password:'preview-test-only-password'});await auth.setCustomUserClaims(u.uid,{teacher:true});
async function token(email,password){const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});if(!r.ok)throw Error('AUTH_FAILED');return (await r.json()).idToken;}
const teacherToken=await token(u.email,'preview-test-only-password');
async function student(){const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true})});if(!r.ok)throw Error('AUTH_FAILED');return (await r.json()).idToken;}
function cookie(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hoja_local='));return raw?sessions.get(raw.slice(11)):null;}
function establish(res,who){const key=randomBytes(24).toString('base64url');sessions.set(key,who);res.setHeader('Set-Cookie',`hoja_local=${key}; HttpOnly; SameSite=Strict; Path=/`);return who;}
const body=async req=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>20000)throw Error('TOO_LARGE');}return JSON.parse(text||'{}');};
const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const catalog=JSON.parse(await readFile(path.join(dist,'cartridges/catalog.json'),'utf8')).cartridges;
const build=JSON.parse(await readFile(path.join(dist,'BUILD.json'),'utf8'));
async function api(req,res){
 if(req.headers.origin&&req.headers.origin!==origin)return reply(res,403,{error:'ORIGIN'});
 const d=await body(req);let who=cookie(req);if(d.action==='join'&&!who)who=establish(res,{role:'student',token:await student()});if(!who)return reply(res,401,{error:'UNAUTHENTICATED'});
 let out;const teacherOnly=()=>{if(who.role!=='teacher')throw Object.assign(new Error('FORBIDDEN'),{code:'FORBIDDEN'});};
 switch(d.action){
  case 'catalog':teacherOnly();out=catalog.map(({id,name,unit,version})=>({id,name,unit,version}));break;
  case 'create':{teacherOnly();const c=catalog.find(x=>x.id===d.cartridgeId);if(!c)throw Error('INVALID_CARTRIDGE');out=await service.createRoom(who.token,{gameVersion:build.gameVersion,cartridgeId:c.id,cartridgeVersion:c.version,durationSeconds:d.durationSeconds});await service.publish(who.token,out.sessionId);break;}
  case 'join':{if(who.role!=='student')throw Object.assign(new Error('STUDENT_ONLY'),{code:'STUDENT_ONLY'});const c=catalog.find(x=>x.id===d.cartridgeId);if(!c)throw Error('INVALID_CARTRIDGE');out=await service.join(who.token,d.sessionId,{inviteToken:d.inviteToken,name:d.name,gameVersion:build.gameVersion,cartridgeVersion:c.version});break;}
  case 'view':out=await service.roomView(who.token,d.sessionId,d.participantId);if(who.role==='student'&&d.participantId){await service.heartbeat(who.token,d.sessionId,d.participantId);}break;
  case 'team':teacherOnly();out=await service.assignTeam(who.token,d.sessionId,d.participantId,d.team);break;
  case 'exclude':teacherOnly();out=await service.exclude(who.token,d.sessionId,d.participantId);break;
  case 'rerun':teacherOnly();out=await service.rerun(who.token,d.sessionId,d.participantId);break;
  case 'start':teacherOnly();out=await service.start(who.token,d.sessionId);break;
  case 'reconnect':out=await service.reconnect(who.token,d.sessionId,d.participantId);break;
  case 'submit':out=await service.submit(who.token,d.sessionId,{...d.payload,gameVersion:build.gameVersion});break;
  case 'finalize':teacherOnly();await service.close(who.token,d.sessionId);out=await service.finalize(who.token,d.sessionId);break;
  default:throw Error('UNKNOWN_ACTION');
 }
 reply(res,200,{ok:true,data:out});
}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);
 if(req.method==='GET'&&url.pathname==='/teacher'&&url.searchParams.get('key')===teacherSecret){establish(res,{role:'teacher',token:teacherToken});res.writeHead(303,{Location:'/class.html?teacher=1','Cache-Control':'no-store'});return res.end();}
 if(req.method==='POST'&&url.pathname==='/api/class')return await api(req,res);
 if(req.method!=='GET')return reply(res,405,{error:'METHOD'});
 const name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html',file=path.resolve(dist,name);if(!file.startsWith(dist+path.sep))return reply(res,403,{error:'PATH'});
 const ext=path.extname(file),type=({'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.ogg':'audio/ogg','.png':'image/png','.css':'text/css'})[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await readFile(file));
 }catch(e){if(!res.headersSent)reply(res,e.code==='FORBIDDEN'?403:400,{error:e.code||e.message||'ERROR'});else res.destroy();}});
await new Promise(r=>server.listen(port,host,r));console.log(`교사 시험판: ${origin}/teacher?key=${teacherSecret}`);console.log(`로컬 에뮬레이터 전용 · ${kind} · ${build.gameVersion}`);
async function shutdown(){server.closeAllConnections();await new Promise(r=>server.close(r));await service.dispose();await deleteApp(app);}
process.on('SIGINT',()=>shutdown().finally(()=>process.exit()));process.on('SIGTERM',()=>shutdown().finally(()=>process.exit()));
