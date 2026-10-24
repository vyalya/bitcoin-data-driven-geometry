import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {positionCaptions} from '../src/gear/labelLayout.ts';
const entry=new URL('../src/gear/labels.ts',import.meta.url).pathname;
const code=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm'});
const {signalLabels}=await import(`data:text/javascript;base64,${Buffer.from(code.outputFiles[0].text).toString('base64')}`);
const geometryCode=await build({entryPoints:[new URL('../src/gear/geometry.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {buildGearGeometry}=await import(`data:text/javascript;base64,${Buffer.from(geometryCode.outputFiles[0].text).toString('base64')}`);
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const snapshots=read('public/data/snapshots.json'),all=read('public/data/blocks.json'),data=read('public/data/block-fees.json');
const dispose=core=>{core.rails.dispose();core.links.dispose();};

test('signal labels exist only for measured geometry across every published date',()=>{
  for(const day of snapshots){
    const blocks=all[day.date],fees=data.days[day.date].feesSat;
    const core=buildGearGeometry(blocks,fees,data.maxNonCoinbase,data.maxBlockFeesSat);
    const count=Math.min(Math.floor((day.activeAddresses??0)/day.scales.detailAddressesPerParticle),1500);
    const labels=signalLabels(day,blocks,core,count),ids=labels.map(x=>x.id);
    assert.equal(ids.length,new Set(ids).size);
    assert.ok(ids.includes('blocks')&&ids.includes('weight'));
    assert.equal(ids.includes('transactions'),blocks.some(b=>b[3]>1));
    assert.equal(ids.includes('fees-total'),fees.some(f=>f>0));
    assert.equal(ids.includes('difficulty'),day.difficulty>1);
    assert.equal(ids.includes('hashrate'),day.networkHashrateEh>0);
    assert.equal(ids.includes('addresses'),count>0);
    for(const label of labels){assert.ok([label.anchor.x,label.anchor.y,label.anchor.z].every(Number.isFinite));assert.ok(label.row>0&&label.row<1);}
    dispose(core);
  }
});

test('transaction and fee leaders point inside actual positive bar faces',()=>{
  const blocks=[[1,100,400,1],[2,100,2000,250],[3,100,3000,400]],fees=[0,10000,20000];
  const core=buildGearGeometry(blocks,fees,399,20000);
  const snapshot={difficulty:1,networkHashrateEh:null,scales:{difficulty:100,hashrateEh:100}};
  const labels=signalLabels(snapshot,blocks,core,0);
  for(const [id,matrices] of [['transactions',core.transactionMatrices],['fees-total',core.feeMatrices]]){
    const label=labels.find(l=>l.id===id);assert.ok(label);
    const local=label.anchor.clone().applyMatrix4(matrices[2].clone().invert());
    assert.ok(Math.abs(local.x)<1e-12&&Math.abs(local.y-.4)<1e-12&&Math.abs(local.z-.5)<1e-12);
  }
  dispose(core);
});


test('wide-view captions stay near their geometry instead of the viewport edges',()=>{
  const result=positionCaptions([{id:'blocks',x:920,y:350,side:'left'},{id:'hashrate',x:1110,y:500,side:'right'}],2048,900,118);
  const left=result.find(p=>p.id==='blocks'),right=result.find(p=>p.id==='hashrate');
  assert.equal(left.x-(left.left+118),22);
  assert.equal(right.left-right.x,22);
  assert.ok(left.left>700&&right.left<1300);
});

test('clustered captions remain separated and within portrait, tablet and desktop viewports',()=>{
  for(const [width,height] of [[320,480],[820,300],[2048,900]]){
    const labelWidth=Math.min(118,width*.32);
    const points=Array.from({length:7},(_,i)=>({id:String(i),x:width/2,y:height/2+i*2,side:i<4?'left':'right'}));
    const positions=positionCaptions(points,width,height,labelWidth);
    for(const p of positions){assert.ok(p.left>=8&&p.top>=8);assert.ok(p.left+labelWidth<=width-8);assert.ok(p.top+24<=height-8);}
    for(const side of ['left','right']){
      const column=positions.filter(p=>p.side===side).sort((a,b)=>a.top-b.top);
      for(let i=1;i<column.length;i++)assert.ok(column[i].top-column[i-1].top>=31);
    }
  }
});
