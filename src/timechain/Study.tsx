import { useEffect, useState } from 'react';
import { loadSnapshots, loadBlockDetailsForDate } from '../db';
import { formatMetric } from '../metrics';
import type { BlockRecord, NetworkSnapshot } from '../types';
import { TimechainScene, type Signal, type Inspection, type StudyScales } from './Scene';
import type { Layout } from './model';
import './study.css';

const arrangements:{id:Layout;name:string;number:string;description:string}[]=[
  {id:'spiral',name:'Timechain',number:'01',description:'An open ledger, coiled into a fingerprint. The chain grows from the inside out.'},
  {id:'ribbon',name:'Ribbon',number:'02',description:'The same blocks unfold into a continuous ribbon. Follow the ledger from side to side.'},
  {id:'strata',name:'Tapestry',number:'03',description:'A softly curved field of blocks. An arrangement made for reading the detail.'}
];
const signals:{id:Signal;name:string;shape:string;description:string}[]=[
  {id:'blocks',name:'Blocks',shape:'One tile · one block',description:'Every tile is a real block, ordered by height. Thin links join consecutive heights only; gaps remain unlinked. The spiral and folds are arrangements, not a network map.'},
  {id:'weight',name:'Block weight',shape:'Tile height',description:'Height is linear: a fixed 0.06 base plus 0.70 × weight / 4,000,000 WU. The base keeps early blocks visible. 4 MWU is a modern comparison reference, not an early consensus limit.'},
  {id:'transactions',name:'Transactions',shape:'Ivory inscription',description:'Each ivory bar measures that block’s non-coinbase transactions on a shared linear scale. Their counts sum to the daily total. Zero produces no mark.'},
  {id:'fees',name:'Fees',shape:'Copper inscription',description:'Each copper bar measures its block’s total fee using log(1 + BTC) relative to the largest block fee in the release. This reveals a wide range of fees; bar lengths are not additive. The daily total sums integer satoshis.'},
  {id:'difficulty',name:'Difficulty',shape:'Inner foundation gauge',description:'The orange foundation gauge measures log10(mean block difficulty) / log10(release maximum). The dim rail is the full-scale reference; difficulty 1 leaves it unfilled.'},
  {id:'hashrate',name:'Estimated hashrate',shape:'Outer foundation gauge',description:'The pale foundation gauge measures the daily EH/s estimate on the existing shared linear scale. CoinMetrics uses normalized Median-Time-Past days. This is not observed electricity use or a security score.'},
  {id:'addresses',name:'Active addresses',shape:'Surrounding stipples',description:'One dot per 1,000 active addresses, rounded down; capped at 1,500. CoinMetrics normalized days. These are addresses, not people or peer locations. Placement is decorative.'}
];
const comparisons=[['2009-01-03','Genesis'],['2017-12-17','Fee surge'],['2020-03-12','COVID crash'],['2024-04-20','Fourth halving']];
function metric(s:NetworkSnapshot,id:Signal){
  return ({blocks:formatMetric(s.blockCount),weight:formatMetric(s.meanBlockWeight==null?null:s.meanBlockWeight/1e6,3,' MWU'),transactions:formatMetric(s.transactionCount),fees:formatMetric(s.totalFeesBtc,4,' BTC'),difficulty:s.difficulty!=null&&s.difficulty>=1e12?formatMetric(s.difficulty/1e12,3,' T'):formatMetric(s.difficulty,2),hashrate:formatMetric(s.networkHashrateEh,2,' EH/s'),addresses:formatMetric(s.activeAddresses)})[id];
}
export default function TimechainStudy(){
  const [snapshots,setSnapshots]=useState<NetworkSnapshot[]>([]),[scales,setScales]=useState<StudyScales|null>(null);
  const [date,setDate]=useState('2024-04-20'),[layout,setLayout]=useState<Layout>('spiral');
  const [recordSet,setRecordSet]=useState<{date:string;blocks:BlockRecord[]}>({date:'',blocks:[]});
  const [detailError,setDetailError]=useState(''),[dataError,setDataError]=useState(''),[reset,setReset]=useState(0),[rotate,setRotate]=useState(false);
  const [hover,setHover]=useState<Inspection>(null),[pin,setPin]=useState<Inspection>(null),[focus,setFocus]=useState<Signal|null>(null),[signalHover,setSignalHover]=useState<Signal|null>(null);
  const [showNotes,setShowNotes]=useState(false);
  useEffect(()=>{let live=true;Promise.all([loadSnapshots(),fetch('/data/timechain-scales.json').then(async r=>{if(!r.ok)throw Error('Study scales unavailable');const value:StudyScales=await r.json();if(![value.maxNonCoinbase,value.maxBlockFeesSat,value.maxBlocks].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('Invalid study scales');return value;})]).then(([s,c])=>{if(live){setSnapshots(s);setScales(c);}}).catch(e=>{if(live)setDataError(String(e));});return()=>{live=false;};},[]);
  useEffect(()=>{let live=true;setDetailError('');setHover(null);setPin(null);loadBlockDetailsForDate(date).then(blocks=>{if(live)setRecordSet({date,blocks});}).catch(e=>{if(live)setDetailError(String(e));});return()=>{live=false;};},[date]);
  const error=dataError||detailError;
  const snapshot=snapshots.find(s=>s.snapshotTime.startsWith(date));
  const blocks=recordSet.date===date?recordSet.blocks:[];
  const current=hover??pin,selectedBlock=current?blocks[current.index]:null;
  const activeSignal=hover?.signal??signalHover??pin?.signal??focus;
  const signal=signals.find(s=>s.id===activeSignal);
  const selectedLayout=arrangements.find(a=>a.id===layout)!;
  const ready=!!snapshot&&!!scales&&recordSet.date===date;
  const index=snapshots.findIndex(s=>s.snapshotTime.startsWith(date));
  const move=(delta:number)=>{const next=snapshots[index+delta];if(next)setDate(next.snapshotTime.slice(0,10));};
  return <div className="study">
    <header className="study-header"><a className="study-brand" href="/"><span className="study-emblem" aria-hidden="true">₿</span> Bitcoin <span className="study-divider">/</span> A network in time</a><span className="study-status"><i/> Form studies · experimental</span><a className="study-return" href="/">Atom & Classic ↗</a></header>
    <main>
      <section className="study-intro"><div><p className="study-eyebrow">The ledger, made tangible</p><h1>{selectedLayout.name}<span>.</span></h1></div><p>{selectedLayout.description}<br/><span>Real blocks. Seven signals. A softer kind of precision.</span></p><div className="study-layouts" role="group" aria-label="Arrangement">{arrangements.map(a=><button key={a.id} aria-pressed={layout===a.id} onClick={()=>{setLayout(a.id);setHover(null);setSignalHover(null);}}><span>{a.number}</span>{a.name}</button>)}</div></section>
      <section className="study-observatory">
        <div className="study-stage" onPointerLeave={()=>{setHover(null);setSignalHover(null);}}>
          <div className="study-stage-glow"/>
          {ready&&!error&&<TimechainScene snapshot={snapshot} blocks={blocks} scales={scales} layout={layout} focus={activeSignal} inspection={current} rotate={rotate} reset={reset} onHover={v=>setHover(old=>old?.index===v?.index&&old?.signal===v?.signal?old:v)} onPin={v=>{setPin(old=>old?.index===v?.index&&old?.signal===v?.signal?null:v);setRotate(false);}} onSignal={setSignalHover} onSelectSignal={value=>{setFocus(value);setPin(null);}}/>}
          {!ready&&!error&&<div className="study-loading" role="status">Assembling the ledger…</div>}
          {error&&<div className="study-loading" role="alert">{error}<button onClick={()=>window.location.reload()}>Reload data</button></div>}
          <div className="study-stage-top"><span>FIG. {selectedLayout.number} <span>/ {ready?`${blocks.length} real blocks`:'Loading'}</span></span><div><button onClick={()=>{setPin(null);setHover(null);setRotate(v=>!v);}} aria-pressed={rotate}>{rotate?'Pause turn':'Slow turn'}</button><button onClick={()=>{setReset(v=>v+1);setRotate(false);}}>Reset view</button></div></div>
          <div className="study-stage-caption"><span className="study-eyebrow">{date} · UTC</span><h2>{snapshot?.label??'Loading day'}</h2><p>Drag to turn · scroll or pinch to inspect</p></div>
          <div className="study-material-key"><span><i className="tx-key"/> Transactions</span><span><i className="fee-key"/> Fees</span></div>
        </div>
        <aside className="study-inspector" aria-label="Geometry inspector">
          {selectedBlock?<div className="study-block"><div className="study-aside-head"><span>{hover?'Inspecting':'Pinned'} · {current!.index+1}/{blocks.length}</span><button onClick={()=>{setPin(null);setHover(null);}} aria-label="Clear block inspection">×</button></div><h2>Block {selectedBlock.height.toLocaleString('en-US')}</h2><p className="study-muted">{new Date(selectedBlock.timestamp*1000).toISOString().slice(11,19)} UTC · header time</p><dl><div><dt>Weight</dt><dd>{selectedBlock.weight.toLocaleString('en-US')} WU</dd></div><div><dt>Transactions</dt><dd>{(selectedBlock.txCount-1).toLocaleString('en-US')}</dd></div><div><dt>Fees</dt><dd>{formatMetric(selectedBlock.totalFeesSat==null?null:selectedBlock.totalFeesSat/1e8,8,' BTC')}</dd></div></dl><div className="study-block-actions"><button disabled={current!.index===0} onClick={()=>{setHover(null);setPin({index:current!.index-1,signal:'blocks'});}}>← Previous</button><button disabled={current!.index===blocks.length-1} onClick={()=>{setHover(null);setPin({index:current!.index+1,signal:'blocks'});}}>Next →</button><a href={`https://mempool.space/block/${selectedBlock.hash}`} target="_blank" rel="noreferrer">Verify ↗</a></div></div>:<div className="study-aside-intro"><span className="study-eyebrow">Read the object</span><h2>A ledger you can touch.</h2><p>Hover a block to reveal its figures. Click to hold it. Choose a signal to see how it shapes the day.</p><button className="study-inspect-first" disabled={!ready} onClick={()=>setPin({index:0,signal:'blocks'})}>Inspect the first block ↗</button></div>}
          <div className="study-signals">{signals.map((s,i)=><button key={s.id} aria-pressed={focus===s.id} className={activeSignal===s.id?'is-active':''} onClick={()=>{setFocus(f=>f===s.id?null:s.id);setPin(null);}}><span className="study-signal-number">0{i+1}</span><span className="study-signal-label">{s.name}<small>{s.shape}</small></span><span className="study-signal-value">{snapshot?metric(snapshot,s.id):'—'}</span></button>)}</div>
          <div className="study-explanation" aria-live="polite">{signal?<><span className="study-eyebrow">{signal.shape}</span><p>{signal.description}</p></>:<p>Same measurements, three arrangements. The material, spacing and light are artistic choices.</p>}</div>
        </aside>
      </section>
      <section className="study-timeline" aria-label="Choose a historical day"><div><span className="study-eyebrow">Across the years</span><div className="study-date-picker"><button aria-label="Previous day in collection" disabled={index<=0} onClick={()=>move(-1)}>←</button><select aria-label="Historical day" value={date} onChange={e=>setDate(e.target.value)}>{snapshots.map(s=><option key={s.id} value={s.snapshotTime.slice(0,10)}>{s.snapshotTime.slice(0,10)} · {s.label}</option>)}</select><button aria-label="Next day in collection" disabled={index<0||index===snapshots.length-1} onClick={()=>move(1)}>→</button></div></div><div className="study-comparisons">{comparisons.map(([d,label])=><button key={d} onClick={()=>setDate(d)} aria-pressed={date===d}><span>{d.slice(0,4)}</span>{label}</button>)}</div></section>
      <footer className="study-footer"><p>150 days <span>·</span> 22,374 blocks <span>·</span> Shared scales across every date</p><button onClick={()=>setShowNotes(v=>!v)} aria-expanded={showNotes}>{showNotes?'Close':'Design & data notes'} {showNotes?'−':'+'}</button></footer>
      {showNotes&&<section className="study-notes"><div><span className="study-eyebrow">Why this form</span><h2>The ledger is the symbol.</h2><p>Bitcoin becomes recognizable through its structure: discrete blocks, ordering, constrained block space, fees and work. The open chain has no hub, and its last block never loops back to its first.</p><p>Timechain is the sculpture. Ribbon traces the sequence. Tapestry exposes its texture. All three use identical dimensions, measurements and scales.</p></div><div><span className="study-eyebrow">What is measured</span><p>Every block and fee comes from the existing audited release. No new query is required. Transaction bars exclude coinbase and use a release maximum of {scales?.maxNonCoinbase.toLocaleString('en-US')??'…'}. Fee bars use a logarithmic scale, reaching a maximum at {scales?formatMetric(scales.maxBlockFeesSat/1e8,8,' BTC'):'…'}.</p><p>Blocks use miner-supplied header UTC dates. CoinMetrics hashrate and addresses use normalized Median-Time-Past dates. The rails and dots therefore describe a different daily window. Missing values have no fill; the figures distinguish missing from zero.</p><a href="/data/provenance.json" target="_blank" rel="noreferrer">Full data provenance ↗</a></div><div><span className="study-eyebrow">The next layer</span><p>A witness strand could emerge at SegWit, using existing size and weight. A diminishing issuance strand could show scheduled subsidy by block height. Neither requires a new data source.</p><p>On demand, real block headers and transaction IDs could unfold into a verified Merkle tree. That would show how Bitcoin commits to transactions—not a fabricated peer or payment network.</p><p className="study-muted">A local design study. Atom and Classic remain available.</p></div></section>}
    </main>
  </div>;
}
