import test from 'node:test';import assert from 'node:assert/strict';
import {assertReady,PROJECT} from './isolation.mjs';import {createLocalService} from './service.mjs';
const env={GCLOUD_PROJECT:PROJECT,GOOGLE_CLOUD_PROJECT:PROJECT,FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'};
test('with emulators actually stopped, initialization fails closed',async()=>{
 await assert.rejects(assertReady(env),e=>e.code==='EMULATOR_ISOLATION_REQUIRED');
 await assert.rejects(createLocalService(),e=>e.code==='EMULATOR_ISOLATION_REQUIRED');
});
