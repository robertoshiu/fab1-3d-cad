import assert from 'node:assert/strict';
import {ohtState,truckState,doorOpening,ROAD_LENGTH,roadPose} from './src/operation-cycles.js';
let samples=0;
for(let t=0;t<182;t+=.025){
 const s=truckState(t);
 // Truck extends 3.4 m forward/rearward at the straight gate lanes.
 if(Math.abs(s.z-26)<.01&&Math.abs(s.x-20)<3.5)assert.ok(s.entry>.999,`entry blocked at ${t}: ${s.x}`);
 if(Math.abs(s.z-34)<.01&&Math.abs(s.x-20)<3.5)assert.ok(s.exit>.999,`exit blocked at ${t}: ${s.x}`);
 const o=ohtState(t,-33.67,-28.45);
 assert.ok(o.payloadY>=16.89-1e-8&&o.payloadY<=18.94+1e-8);
 if(o.travel){assert.equal(o.gripped,true);assert.equal(o.hoistY,18.94);}
 if(!o.gripped)assert.equal(o.payloadY,16.89);
 const next=ohtState(t+.001,-33.67,-28.45);
 assert.ok(Math.abs(next.payloadY-o.payloadY)<.002,'payload continuity');
 assert.ok(Math.abs(next.z-o.z)<.002,'track continuity');
 for(const offset of [0,9,18,27,36])assert.ok(doorOpening(t,offset)>=0&&doorOpening(t,offset)<=1);
 samples++;
}
for(let t=0;t<88;t+=.05){
 const a=ohtState(t,-33.67,-28.45),c=ohtState(t+57,-20.77,-15.55);
 assert.ok(Math.abs(a.z-c.z)>7,'same-rail separation');
}
const a=roadPose(ROAD_LENGTH-.0001),b=roadPose(.0001);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.001,'route wrap continuity');
console.log(JSON.stringify({passed:true,samples,checks:['entry/exit clearance at every 25 ms','raised payload while travelling','no FOUP teleport during transfer','carrier separation','door bounds','closed road continuity']}));
