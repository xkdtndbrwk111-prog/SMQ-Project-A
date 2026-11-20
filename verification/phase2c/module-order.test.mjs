import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkModuleOrder} from '../../tools/check_module_order.mjs';
const page = name => readFileSync(new URL('../../web/current/'+name,import.meta.url),'utf8');
const pages = {'index.html':page('index.html'),'play.html':page('play.html'),'arcade.html':page('arcade.html')};
test('current module and page order is valid',()=>assert.deepEqual(checkModuleOrder(pages),[]));
test('missing, delayed and reordered module tags fail',()=>{
 const original=pages['arcade.html'];
 for(const changed of [
   original.replace('<script src="js/rafts.js"></script>',''),
   original.replace('<script src="js/rafts.js">','<script async src="js/rafts.js">'),
   original.replace('<script src="js/enemies/system.js"></script>','').replace('<script src="js/enemies/jumpy.js"></script>','<script src="js/enemies/jumpy.js"></script><script src="js/enemies/system.js"></script>')
 ]) assert.ok(checkModuleOrder({...pages,'arcade.html':changed}).length>0);
});
