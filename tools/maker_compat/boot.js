// Test-only standalone host: use the existing arcade host protocol and built-in test cartridge.
(async()=>{
 try{
  const catalog=await (await fetch('cartridges/catalog.json')).json();
  const entry=catalog.cartridges.find(c=>c.id==='test-joseon-a'&&c.test);
  if(!entry)throw Error('시험 카트리지를 찾을 수 없습니다.');
  const response=await fetch(entry.path);if(!response.ok)throw Error('시험 카트리지를 불러오지 못했습니다.');
  const data=await response.json();
  window.postMessage({type:'HOJA_V058_ARCADE_START',names:[entry.name],sources:[{sheetName:entry.name,data}]},location.origin);
 }catch(error){document.getElementById('bootStatus').textContent=error.message;}
})();
