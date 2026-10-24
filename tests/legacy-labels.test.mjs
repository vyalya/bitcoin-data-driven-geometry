import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {InstancedMesh,BoxGeometry,MeshBasicMaterial,Matrix4,Vector3,Quaternion,Euler} from 'three';
import {setBlockInstances} from '../src/geometry.ts';
const ringsCode=await build({entryPoints:[new URL('../src/rings.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {coreRingSpecs}=await import(`data:text/javascript;base64,${Buffer.from(ringsCode.outputFiles[0].text).toString('base64')}`);
const compiled=await build({entryPoints:[new URL('../src/legacyLabels.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {legacySignalLabels,legacyEndpoints}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const days=read('public/data/snapshots.json'),all=read('public/data/blocks.json');

test('Atom and Classic captions match the drawn tooth and each measured ring plane across all dates',()=>{
  for(const style of ['atom','classic'])for(const day of days){
    const blocks=all[day.date],address=new Vector3(1,2,3),count=Math.min(1500,Math.floor((day.activeAddresses??0)/day.scales.detailAddressesPerParticle));
    const labels=legacySignalLabels(day,blocks,style,count,address),ids=labels.map(l=>l.id);
    assert.equal(ids.length,new Set(ids).size);
    const mesh=new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial(),blocks.length);
    setBlockInstances(mesh,blocks,style);
    const index=blocks.reduce((best,b,i)=>b[2]>blocks[best][2]?i:best,0),matrix=new Matrix4();mesh.getMatrixAt(index,matrix);
    for(const [id,z] of [['blocks',.35],['weight',-.5]]){
      const actual=labels.find(l=>l.id===id).anchor,expected=new Vector3(0,0,z).applyMatrix4(matrix);
      assert.ok(expected.distanceTo(actual)<1e-6,`${day.date} ${style} ${id} must point to the drawn tooth`);
    }
    for(const ring of coreRingSpecs(day,style)){
      const label=labels.find(l=>l.id===ring.id);
      assert.equal(!!label,2*Math.PI*ring.fill>=1e-6);
      if(label){
        const local=label.anchor.clone().applyQuaternion(new Quaternion().setFromEuler(new Euler(...ring.rotation)).invert());
        assert.ok(Math.abs(local.z)<1e-10);
        assert.ok(Math.abs(Math.hypot(local.x,local.y)-ring.radius)<1e-10);
        const angle=(Math.atan2(local.y,local.x)+2*Math.PI)%(2*Math.PI);
        assert.ok(Math.abs(angle-2*Math.PI*ring.fill*.55)<1e-10);
      }
    }
    assert.equal(ids.includes('addresses'),count>0);
    if(count>0){assert.equal(labels.find(l=>l.id==='addresses').anchor,address);address.set(4,5,6);assert.equal(labels.find(l=>l.id==='addresses').anchor.x,4);}
    mesh.geometry.dispose();mesh.material.dispose();
  }
});

test('legacy first/last captions retain actual height identities without inventing endpoints',()=>{
  for(const style of ['atom','classic']){
    assert.deepEqual(legacyEndpoints([],style),[]);
    const one=legacyEndpoints([[0,285,1140,1]],style);
    assert.equal(one.length,1);assert.equal(one[0].height,0);assert.equal(one[0].role,'only');
    const blocks=[[12,100,400,1],[15,300,1200,2]];
    const ends=legacyEndpoints(blocks,style);
    assert.deepEqual(ends.map(e=>[e.height,e.role]),[[12,'start'],[15,'end']]);
    assert.ok(ends.every(e=>e.position.every(Number.isFinite)));
  }
});
