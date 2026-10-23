import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BlockRecord, NetworkSnapshot } from '../types';
import { placement, tileHeight, txFill, feeFill, blockAdjacent, addressCount, type Layout } from './model';
import { difficultyFill, normalized, randomFor } from '../metrics';
import {fitStudyCamera, type StudyControls} from './camera';

export type Signal = 'blocks'|'weight'|'transactions'|'fees'|'difficulty'|'hashrate'|'addresses';
export type StudyScales = {maxNonCoinbase:number;maxBlockFeesSat:number;maxBlocks:number;release:string};
export type Inspection = {index:number;signal:Signal}|null;
type Props = {blocks:BlockRecord[];snapshot:NetworkSnapshot;scales:StudyScales;layout:Layout;focus:Signal|null;inspection:Inspection;rotate:boolean;onHover:(value:Inspection)=>void;onPin:(value:Inspection)=>void;onSignal:(signal:Signal|null)=>void;onSelectSignal:(signal:Signal)=>void};

function Tiles({blocks,scales,layout,focus,inspection,onHover,onPin}:Props){
  const body=useRef<THREE.InstancedMesh>(null), tx=useRef<THREE.InstancedMesh>(null),fees=useRef<THREE.InstancedMesh>(null);
  const geometry=useMemo(()=>new RoundedBoxGeometry(1,1,1,2,.10),[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useLayoutEffect(()=>{
    if(!body.current||!tx.current||!fees.current)return;
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    const meshes=[body.current,tx.current,fees.current];
    blocks.forEach((block,i)=>{
      const pose=placement(i,layout),height=tileHeight(block.weight);
      const active=inspection?.index===i;
      dummy.position.set(pose.position[0],pose.position[1]+height/2,pose.position[2]);
      dummy.rotation.set(0,pose.yaw,0);dummy.scale.set(.16,height,.30);dummy.updateMatrix();
      body.current!.setMatrixAt(i,dummy.matrix);
      body.current!.setColorAt(i,color.set(active?'#ffe0aa':focus&&focus!=='blocks'&&focus!=='weight'?'#694728':'#ed8c24'));
      [txFill(block,scales.maxNonCoinbase)??0,feeFill(block.totalFeesSat,scales.maxBlockFeesSat)??0].forEach((fill,j)=>{
        const length=.24*fill,offset=new THREE.Vector3(j===0?-.039:.039,height+.008,-.12+length/2).applyAxisAngle(new THREE.Vector3(0,1,0),pose.yaw);
        dummy.position.set(...pose.position).add(offset);dummy.scale.set(.025,.012,length);dummy.updateMatrix();
        meshes[j+1].setMatrixAt(i,dummy.matrix);
      });
    });
    for(const mesh of meshes){mesh.count=blocks.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  },[blocks,layout,scales,focus,inspection]);
  const events=(signal:Signal)=>({
    onPointerMove:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();if(e.instanceId!==undefined)onHover({index:e.instanceId,signal});},
    onPointerOut:()=>onHover(null),
    onClick:(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta<=5&&e.instanceId!==undefined)onPin({index:e.instanceId,signal});}
  });
  if(!blocks.length)return null;
  return <group>
    <instancedMesh ref={body} key={`body-${blocks.length}`} args={[geometry,undefined,blocks.length]} castShadow receiveShadow {...events('weight')}>
      <meshStandardMaterial color="white" roughness={.48} metalness={.4} emissive="#6c3009" emissiveIntensity={.12}/>
    </instancedMesh>
    <instancedMesh ref={tx} key={`tx-${blocks.length}`} args={[geometry,undefined,blocks.length]} {...events('transactions')}>
      <meshStandardMaterial color={focus==='transactions'?'#ffffff':'#ffdfaa'} emissive="#ffcd83" emissiveIntensity={focus==='transactions'?1:.4} roughness={.6}/>
    </instancedMesh>
    <instancedMesh ref={fees} key={`fees-${blocks.length}`} args={[geometry,undefined,blocks.length]} {...events('fees')}>
      <meshStandardMaterial color={focus==='fees'?'#fff1cc':'#fd9d4c'} emissive="#ff6f20" emissiveIntensity={focus==='fees'?1:.35} roughness={.6}/>
    </instancedMesh>
  </group>;
}
function Links({blocks,layout}:{blocks:BlockRecord[];layout:Layout}){
  const positions=useMemo(()=>{
    const a:number[]=[];
    for(let i=1;i<blocks.length;i++)if(blockAdjacent(blocks[i-1],blocks[i])){
      for(const j of [i-1,i]){const p=placement(j,layout).position;a.push(p[0],p[1]+.025,p[2]);}
    }
    return new Float32Array(a);
  },[blocks,layout]);
  return <lineSegments raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><lineBasicMaterial color="#965a28" transparent opacity={.6}/></lineSegments>;
}
function Gauge({radius,fill,signal,active,onSignal,onSelectSignal}:{radius:number;fill:number;signal:Signal;active:boolean;onSignal:Props['onSignal'];onSelectSignal:Props['onSelectSignal']}){
  const arc=(fraction:number)=>Array.from({length:Math.max(2,Math.ceil(140*fraction))},(_,i)=>{
    const angle=.12*Math.PI+1.45*Math.PI*fraction*i/(Math.max(2,Math.ceil(140*fraction))-1);
    return [radius*Math.cos(angle),-.06,radius*Math.sin(angle)] as [number,number,number];
  });
  return <group onPointerOver={e=>{e.stopPropagation();onSignal(signal);}} onPointerOut={()=>onSignal(null)} onClick={e=>{e.stopPropagation();if(e.delta<=5)onSelectSignal(signal);}}>
    <Line points={arc(1)} color="#665748" lineWidth={1} transparent opacity={.35}/>
    {fill>0&&<Line points={arc(fill)} color={active?'#fff1d5':signal==='difficulty'?'#f8ad55':'#b7b3a2'} lineWidth={active?4:2}/>} 
  </group>;
}
function Addresses({snapshot,active,onSignal,onSelectSignal}:{snapshot:NetworkSnapshot;active:boolean;onSignal:Props['onSignal'];onSelectSignal:Props['onSelectSignal']}){
  const positions=useMemo(()=>{
    const out:number[]=[];
    for(let i=0;i<(addressCount(snapshot.activeAddresses)??0);i++){
      const a=randomFor(i,10)*Math.PI*2,r=4.10+randomFor(i,11)*.8;
      out.push(Math.cos(a)*r,-.1+randomFor(i,12)*.65,Math.sin(a)*r);
    }
    return new Float32Array(out);
  },[snapshot.activeAddresses]);
  return <points onPointerOver={e=>{e.stopPropagation();onSignal('addresses');}} onPointerOut={()=>onSignal(null)} onClick={e=>{e.stopPropagation();if(e.delta<=5)onSelectSignal('addresses');}}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color={active?'#ffffff':'#c1ac8e'} size={active?.035:.018} sizeAttenuation transparent opacity={active?.9:.48} depthWrite={false}/>
  </points>;
}
function Sculpture(props:Props){
  const group=useRef<THREE.Group>(null);
  useFrame((_,dt)=>{if(group.current&&props.rotate&&!props.inspection)group.current.rotation.y+=Math.min(dt,.05)*.07;});
  return <group ref={group} position={[0,-.3,0]}>
    <Links blocks={props.blocks} layout={props.layout}/><Tiles {...props}/>
    <Gauge radius={3.60} fill={difficultyFill(props.snapshot.difficulty,props.snapshot.scales.difficulty)} signal="difficulty" active={props.focus==='difficulty'} onSignal={props.onSignal} onSelectSignal={props.onSelectSignal}/>
    <Gauge radius={3.80} fill={normalized(props.snapshot.networkHashrateEh,props.snapshot.scales.hashrateEh)} signal="hashrate" active={props.focus==='hashrate'} onSignal={props.onSignal} onSelectSignal={props.onSelectSignal}/>
    <Addresses snapshot={props.snapshot} active={props.focus==='addresses'} onSignal={props.onSignal} onSelectSignal={props.onSelectSignal}/>
  </group>;
}
function FitCamera(){
  const {camera,size,controls}=useThree();
  useLayoutEffect(()=>{
    fitStudyCamera(camera as THREE.PerspectiveCamera,controls as unknown as StudyControls|null,size.width,size.height);
  },[camera,size.width,size.height,controls]);
  return null;
}
export function TimechainScene(props:Props&{reset:number}){
  return <Canvas key={props.reset} shadows dpr={[1,1.7]} camera={{position:[5.4,7.8,8.8],fov:41,near:.05,far:100}} gl={{alpha:true,antialias:true}} raycaster={{params:{Points:{threshold:.035},Line:{threshold:.035},Mesh:{},LOD:{},Sprite:{}}}} onPointerMissed={()=>props.onPin(null)}>
    <FitCamera/><ambientLight intensity={.65}/><hemisphereLight args={['#fff0d6','#322c29',1.1]}/>
    <directionalLight position={[-3,8,5]} color="#fff3df" intensity={3} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-.001}/>
    <directionalLight position={[4,3,-4]} color="#ffa955" intensity={2}/>
    <Sculpture key={props.layout} {...props}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.42,0]} receiveShadow raycast={()=>null}><planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={.18}/></mesh>
    <OrbitControls makeDefault enableDamping dampingFactor={.08} minDistance={2} maxDistance={45} minPolarAngle={.12} maxPolarAngle={Math.PI*.48} target={[0,0,0]} enablePan zoomSpeed={.8}/>
  </Canvas>;
}
