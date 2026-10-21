// Verify that a Pages deployment serves the exact locally validated release.
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,writeJSON} from './lib/data.mjs';
const base=new URL(process.argv[2]);
if(base.protocol!=='https:'||!(base.hostname==='bitcoin-geometry.com'||base.hostname.endsWith('.bitcoin-data-driven-geometry.pages.dev')||base.hostname==='bitcoin-data-driven-geometry.pages.dev'))throw new Error('Unexpected deployment host');
const output=resolve(ROOT,'dist'),files=[];
function scan(dir){for(const name of readdirSync(dir)){const path=resolve(dir,name);if(statSync(path).isDirectory())scan(path);else if(!name.startsWith('_'))files.push(relative(output,path));}}
scan(output);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const errors=[],checks=[];
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{
  while(cursor<files.length){
    const file=files[cursor++];
    try{
      const response=await fetch(new URL(file==='index.html'?'/':`/${file}`,base),{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bytes=Buffer.from(await response.arrayBuffer()),expected=hash(readFileSync(resolve(output,file)));
      if(hash(bytes)!==expected)throw new Error('Content hash mismatch');
      if(file.endsWith('.json')&&!response.headers.get('content-type')?.includes('application/json'))throw new Error('Wrong JSON content type');
      if(file==='index.html'&&response.headers.get('x-frame-options')!=='DENY')throw new Error('Missing framing header');
      checks.push({file,sha256:expected,bytes:bytes.length});
    }catch(error){errors.push({file,error:error.message});}
  }
}));
const report={url:base.origin,verifiedAt:new Date().toISOString(),checked:checks.length,expected:files.length,errors,files:checks.sort((a,b)=>a.file.localeCompare(b.file))};
writeJSON(`audit/deployment-verification-${base.hostname==='bitcoin-geometry.com'?'production':'preview'}.json`,report);
console.log(JSON.stringify({url:report.url,checked:report.checked,expected:report.expected,errors},null,2));
if(errors.length)process.exitCode=1;
