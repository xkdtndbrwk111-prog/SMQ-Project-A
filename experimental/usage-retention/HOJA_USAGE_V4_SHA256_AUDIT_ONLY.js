/* Audit helper for standalone copied-sheet verification, NOT a production
 * cryptographic library. GAS uses Utilities.computeDigest natively.
 * UTF-8 SHA-256 computed without network, Node, browser or identifiers.
 */
var HOJA_USAGE_V4_SHA256_AUDIT_ONLY=(function(){
 'use strict';
 const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,
  0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,
  0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,
  0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,
  0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,
  0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,
  0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,
  0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,
  0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,
  0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,
  0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const initial=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,
  0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const rot=(x,n)=>(x>>>n)|(x<<(32-n));
 function sha256(input){
  const bytes=[];
  for(const ch of String(input)){
   const cp=ch.codePointAt(0);
   if(cp<128)bytes.push(cp);
   else if(cp<2048)bytes.push(0xc0|(cp>>6),0x80|(cp&63));
   else if(cp<65536)bytes.push(0xe0|(cp>>12),0x80|((cp>>6)&63),0x80|(cp&63));
   else bytes.push(0xf0|(cp>>18),0x80|((cp>>12)&63),
    0x80|((cp>>6)&63),0x80|(cp&63));
  }
  const len=BigInt(bytes.length)*8n;
  bytes.push(0x80);
  while(bytes.length%64!==56)bytes.push(0);
  for(let i=7;i>=0;i--)bytes.push(Number((len>>BigInt(i*8))&255n));
  const h=[...initial];
  for(let i=0;i<bytes.length;i+=64){
   const w=new Array(64);
   for(let j=0;j<16;j++){
    const at=i+j*4;
    w[j]=((bytes[at]<<24)|(bytes[at+1]<<16)|(bytes[at+2]<<8)|bytes[at+3])>>>0;
   }
   for(let j=16;j<64;j++){
    const s0=rot(w[j-15],7)^rot(w[j-15],18)^(w[j-15]>>>3);
    const s1=rot(w[j-2],17)^rot(w[j-2],19)^(w[j-2]>>>10);
    w[j]=(w[j-16]+s0+w[j-7]+s1)>>>0;
   }
   let [a,b,c,d,e,f,g,z]=h;
   for(let j=0;j<64;j++){
    const S1=rot(e,6)^rot(e,11)^rot(e,25),ch=(e&f)^(~e&g);
    const t1=(z+S1+ch+K[j]+w[j])>>>0;
    const S0=rot(a,2)^rot(a,13)^rot(a,22);
    const maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;
    z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
   }
   const vars=[a,b,c,d,e,f,g,z];
   for(let j=0;j<8;j++)h[j]=(h[j]+vars[j])>>>0;
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
 }
 return Object.freeze({sha256});
})();