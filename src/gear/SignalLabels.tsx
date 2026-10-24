import {useRef} from 'react';
import {Html} from '@react-three/drei';
import {useFrame,useThree} from '@react-three/fiber';
import {Group,Vector3} from 'three';
import type {RefObject} from 'react';
import type {SignalLabel} from './labels';
import {positionCaptions} from './labelLayout';
import type {ProjectedLabel} from './labelLayout';

/** Upright captions follow their geometry with short, locally arranged leaders. */
export function SignalLabels({labels,root}:{labels:SignalLabel[];root:RefObject<Group|null>}) {
  const {size,camera}=useThree();
  const groups=useRef(new Map<string,SVGGElement>());
  const point=useRef(new Vector3());
  const captionWidth=Math.min(118,size.width*.32);
  useFrame(()=>{
    if(!root.current)return;
    root.current.updateWorldMatrix(true,false);
    const visiblePoints:ProjectedLabel[]=[];
    for(const label of labels){
      const element=groups.current.get(label.id);if(!element)continue;
      point.current.copy(label.anchor).applyMatrix4(root.current.matrixWorld).project(camera);
      const x=(point.current.x+1)*size.width/2,y=(1-point.current.y)*size.height/2;
      const visible=point.current.z>=-1&&point.current.z<=1&&x>=0&&x<=size.width&&y>=0&&y<=size.height;
      element.style.visibility=visible?'visible':'hidden';
      if(visible)visiblePoints.push({id:label.id,x,y,side:label.side});
    }
    for(const caption of positionCaptions(visiblePoints,size.width,size.height,captionWidth)){
      const element=groups.current.get(caption.id)!;
      const line=element.querySelector('line')!,dot=element.querySelector('circle')!,box=element.querySelector('rect')!,text=element.querySelector('text')!;
      const left=caption.side==='left';
      line.setAttribute('x1',String(left?caption.left+captionWidth:caption.left));line.setAttribute('y1',String(caption.top+12));
      line.setAttribute('x2',String(caption.x));line.setAttribute('y2',String(caption.y));
      dot.setAttribute('cx',String(caption.x));dot.setAttribute('cy',String(caption.y));
      box.setAttribute('x',String(caption.left));box.setAttribute('y',String(caption.top));
      text.setAttribute('x',String(left?caption.left+7:caption.left+captionWidth-7));text.setAttribute('y',String(caption.top+15));
    }
  });
  return <Html fullscreen calculatePosition={(_object,_camera,viewport)=>[viewport.width/2,viewport.height/2]} style={{pointerEvents:'none'}}>
    <svg className="gear-signal-overlay" width={size.width} height={size.height} aria-label="Geometry signal labels">
      {labels.map(label=><g key={label.id} style={{visibility:'hidden'}} ref={node=>{if(node)groups.current.set(label.id,node);else groups.current.delete(label.id);}}>
        <line/><circle r="1.5"/><rect width={captionWidth} height="24" rx="4"/>
        <text textAnchor={label.side==='left'?'start':'end'}>{label.text}</text>
      </g>)}
    </svg>
  </Html>;
}
