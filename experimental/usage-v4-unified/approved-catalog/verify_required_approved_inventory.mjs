// Independent inventory gate. Does not grant deployment approval.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const ledger=JSON.parse(readFileSync(new URL('./required-approved-inventory.json',import.meta.url),'utf8'));
export function verifyRequiredApprovedInventory(index,manifest,required=ledger.requiredIds){
 assert.ok(Array.isArray(required)&&required.length&&new Set(required).size===required.length,'INVENTORY_INVALID');
 const ids=(rows,label)=>{
  assert.ok(Array.isArray(rows),label+'_INVALID');
  const set=new Set();
  for(const e of rows){assert.ok(e&&typeof e.cartridgeId==='string'&&!set.has(e.cartridgeId),label+'_DUPLICATE');set.add(e.cartridgeId)}
  return set;
 };
 const source=ids(index.entries,'SOURCE'),release=ids(manifest.entries,'RELEASE');
 const missingSource=required.filter(id=>!source.has(id));
 const missingRelease=required.filter(id=>!release.has(id));
 if(missingSource.length||missingRelease.length)throw Error('APPROVED_INVENTORY_MISSING source='+missingSource.join(',')+' release='+missingRelease.join(','));
 return {required:required.length,source:source.size,release:release.size};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [idx,manifest]=process.argv.slice(2);
 const j=p=>JSON.parse(readFileSync(p,'utf8'));
 console.log(JSON.stringify(verifyRequiredApprovedInventory(j(idx),j(manifest))));
}
