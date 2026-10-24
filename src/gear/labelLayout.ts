export type ProjectedLabel={id:string;x:number;y:number;side:'left'|'right'};
export type CaptionPosition=ProjectedLabel&{left:number;top:number};

/** Keep captions close to their anchors, separated vertically on each side. */
export function positionCaptions(points:ProjectedLabel[],width:number,height:number,captionWidth:number,captionHeight=24):CaptionPosition[] {
  const pad=8,gap=7,offset=22;
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
  const output:CaptionPosition[]=[];
  for(const side of ['left','right'] as const){
    const column=points.filter(p=>p.side===side).sort((a,b)=>a.y-b.y).map(p=>({...p,
      left:clamp(side==='left'?p.x-captionWidth-offset:p.x+offset,pad,width-captionWidth-pad),
      top:clamp(p.y-captionHeight/2,pad,height-captionHeight-pad),
    }));
    for(let i=1;i<column.length;i++)column[i].top=Math.max(column[i].top,column[i-1].top+captionHeight+gap);
    if(column.length){
      column[column.length-1].top=Math.min(column[column.length-1].top,height-captionHeight-pad);
      for(let i=column.length-2;i>=0;i--)column[i].top=Math.min(column[i].top,column[i+1].top-captionHeight-gap);
      if(column[0].top<pad){const shift=pad-column[0].top;column.forEach(p=>p.top+=shift);}
    }
    output.push(...column);
  }
  return output;
}
