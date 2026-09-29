// Deterministic demonstration cycles. Metres and seconds; no live telemetry.
export const clamp01=v=>Math.min(1,Math.max(0,v));
export const ease=v=>{const t=clamp01(v);return t*t*(3-2*t);};
export const cycle=(time,duration)=>((time%duration)+duration)%duration;
export const OHT_PERIOD=88;
export function ohtState(time,a,b){
 const t=cycle(time,OHT_PERIOD),up=18.94,down=16.89;
 let z=a,y=up,gripped=true,phase='搬運至下一站';
 if(t<8)z=a+(b-a)*ease(t/8);
 else if(t<44){z=b;
  if(t<14){y=up+(down-up)*ease((t-8)/6);phase='下降・對位';}
  else if(t<16){y=down;gripped=false;phase='放置・確認';}
  else if(t<22){y=down+(up-down)*ease((t-16)/6);gripped=false;phase='空吊具上升';}
  else if(t<30){gripped=false;phase='機台接收・等待';}
  else if(t<36){y=up+(down-up)*ease((t-30)/6);gripped=false;phase='空吊具下降';}
  else if(t<38){y=down;phase='夾持・確認';}
  else{y=down+(up-down)*ease((t-38)/6);phase='載物上升';}
 }else if(t<52){z=b+(a-b)*ease((t-44)/8);phase='回程搬運';}
 else if(t<58){y=up+(down-up)*ease((t-52)/6);phase='下降・對位';}
 else if(t<60){y=down;gripped=false;phase='放置・確認';}
 else if(t<66){y=down+(up-down)*ease((t-60)/6);gripped=false;phase='空吊具上升';}
 else if(t<74){gripped=false;phase='機台接收・等待';}
 else if(t<80){y=up+(down-up)*ease((t-74)/6);gripped=false;phase='空吊具下降';}
 else if(t<82){y=down;phase='夾持・確認';}
 else{y=down+(up-down)*ease((t-82)/6);phase='載物上升';}
 return{t,z,hoistY:y,payloadY:gripped?y:down,gripped,phase,travel:t<8||(t>=44&&t<52)};
}
const arc=4*Math.PI;
export const ROAD_LENGTH=190+2*arc,TRUCK_PERIOD=91;
const stops=[[0,0],[5,8],[9,8],[40,95],[46,95+arc],[72,168+arc],[76,168+arc],[85,190+arc],[91,ROAD_LENGTH]];
export function roadPose(distance){
 const d=cycle(distance,ROAD_LENGTH);
 if(d<95)return{x:5+d,z:26,heading:Math.PI/2};
 if(d<95+arc){const a=(d-95)/4;return{x:100+4*Math.sin(a),z:30-4*Math.cos(a),heading:Math.PI/2-a};}
 if(d<190+arc)return{x:100-(d-95-arc),z:34,heading:-Math.PI/2};
 const a=(d-190-arc)/4;return{x:5-4*Math.sin(a),z:30+4*Math.cos(a),heading:-Math.PI/2-a};
}
export function truckState(time){
 const t=cycle(time,TRUCK_PERIOD),i=stops.findIndex((p,j)=>j<stops.length-1&&t>=p[0]&&t<stops[j+1][0]);
 const [ta,da]=stops[Math.max(0,i)],[tb,db]=stops[Math.max(0,i)+1];
 const u=(t-ta)/(tb-ta),turnSpeed=arc/6;
 const velocities=[[turnSpeed,0],[0,0],[0,turnSpeed],[turnSpeed,turnSpeed],[turnSpeed,0],[0,0],[0,turnSpeed],[turnSpeed,turnSpeed]];
 const [va,vb]=velocities[Math.max(0,i)],dt=tb-ta;
 const distance=(2*u**3-3*u*u+1)*da+(u**3-2*u*u+u)*dt*va+(-2*u**3+3*u*u)*db+(u**3-u*u)*dt*vb;
 const entry=t<5?0:t<8?ease((t-5)/3):t<20?1:t<23?1-ease((t-20)/3):0;
 const exit=t<72?0:t<75?ease((t-72)/3):t<84?1:t<87?1-ease((t-84)/3):0;
 return{t,distance,...roadPose(distance),entry,exit,moving:db!==da,phase:t<5?'進場減速':t<9?'停等・入場閘門':t<46?'入場運輸':t<72?'出場運輸':t<76?'停等・出場閘門':'離場回程'};
}
export function doorOpening(time,offset=0){const t=cycle(time+offset,48);return t<5?ease(t/5):t<25?1:t<30?1-ease((t-25)/5):0;}
