// Blocks within the same nucleus are distinct selections, not one toggle.
export function sameSelection(a:{type:string;block?:readonly number[]},b:{type:string;block?:readonly number[]}) {
  return a.type===b.type && (a.type!=='block'||a.block?.[0]===b.block?.[0]);
}

// A hover is a temporary preview. Leaving it restores the pinned figures;
// freezing animation must not prevent inspection of a different object.
export function inspectSelection<T extends {type:string;block?:readonly number[]}>(hover:T,hoverGroup:string|null,pin:T,pinGroup:string|null) {
  const context=hoverGroup!==null && hover.type!=='none' ? hover : pinGroup ? pin : hover;
  return {context,group:hoverGroup??pinGroup,pinned:pinGroup!==null && sameSelection(pin,context)};
}
