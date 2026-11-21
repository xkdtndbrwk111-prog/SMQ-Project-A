// Test-only runtime guard. Never initialize a Firebase SDK before this check.
export const PROJECT='demo-hoja-phase3a';
const AUTH='127.0.0.1:19099', FIRESTORE='127.0.0.1:18080';
const deny=()=>{throw Object.assign(new Error('EMULATOR_ISOLATION_REQUIRED'),{code:'EMULATOR_ISOLATION_REQUIRED'});};
export function assertIsolation(env=process.env){
 if(env.GCLOUD_PROJECT!==PROJECT||env.GOOGLE_CLOUD_PROJECT!==PROJECT||env.FIRESTORE_EMULATOR_HOST!==FIRESTORE||env.FIREBASE_AUTH_EMULATOR_HOST!==AUTH||env.GOOGLE_APPLICATION_CREDENTIALS)deny();
 return {projectId:PROJECT,authHost:AUTH,firestoreHost:FIRESTORE};
}
export async function assertReady(env=process.env){
 const config=assertIsolation(env);
 try{
  const [hub,firestore,auth]=await Promise.all([
   fetch('http://127.0.0.1:4400/emulators',{signal:AbortSignal.timeout(1500)}),
   fetch('http://127.0.0.1:18080/',{signal:AbortSignal.timeout(1500)}),
   fetch('http://127.0.0.1:19099/emulator/v1/projects/demo-hoja-phase3a/accounts',{signal:AbortSignal.timeout(1500)})
  ]);
  const services=await hub.json(),firestoreText=await firestore.text(),authText=await auth.text();
  if(!hub.ok||!firestore.ok||firestoreText.trim()!=='Ok'||auth.status!==405||!authText.includes('/emulator/v1/projects/demo-hoja-phase3a/accounts')||services.auth?.host!=='127.0.0.1'||services.auth?.port!==19099||services.firestore?.host!=='127.0.0.1'||services.firestore?.port!==18080)deny();
 }catch{deny();}
 return config;
}
