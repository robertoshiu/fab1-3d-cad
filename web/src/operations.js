import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import layout from './operations-layout.json';
import { ohtState, truckState, doorOpening, cycle, ROAD_LENGTH, TRUCK_PERIOD } from './operation-cycles.js';

export const OPERATION_VIEWS = {
  OHT:{title:'OHT 物料配送',floor:'F1',position:[45.8,18.5,-38.9],target:[43.5,18,-31],fov:58},
  LOGISTICS:{title:'車輛與閘門',floor:'ALL',position:[-8,15,48],target:[22,1.8,28],fov:55},
  DOORS:{title:'裝卸門啟閉',floor:'ALL',position:[30,7,19],target:[20,2.5,.4],fov:52},
  AIR:{title:'FFU 送風',floor:'F2',position:[43.5,32.7,-17.8],target:[44.5,30,-22],fov:57},
  ROOF:{title:'屋頂排風',floor:'RF',position:[5.5,47.5,-23],target:[13.5,44,-29],fov:55},
  UTILITIES:{title:'支援管線流向',floor:'B1',position:[44,-4.5,-28],target:[42,-6.1,-33],fov:58},
};
const M=(color,metalness=0,roughness=.5)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const boxGeo=new THREE.BoxGeometry(1,1,1);
const vec=new THREE.Vector3(),matrix=new THREE.Matrix4(),identity=new THREE.Quaternion();
function part(parent,geo,mat,pos=[0,0,0],scale=[1,1,1]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.userData.viewerDynamic=true;parent.add(m);return m;}
function box(parent,mat,pos,size){return part(parent,boxGeo,mat,pos,size);}
function node(parent){const n=new THREE.Group();n.userData.viewerDynamic=true;parent.add(n);return n;}
function mergeParts(group){
  const buckets=new Map();for(const mesh of group.children.filter(o=>o.isMesh)){
    const key=mesh.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(mesh);
  }
  for(const meshes of buckets.values()){
    if(meshes.length<2)continue;
    const copies=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
    const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());if(!geometry)continue;
    meshes.forEach(m=>group.remove(m));part(group,geometry,meshes[0].material);
  }
}
function rotorGeometry(radius){
  const p=[];
  for(let k=0;k<7;k++){
    const a=k*Math.PI*2/7;
    const points=[[.22,-.08],[.95,-.08],[.85,.24],[.25,.08]].map(([x,z])=>[radius*(x*Math.cos(a)-z*Math.sin(a)),0,radius*(x*Math.sin(a)+z*Math.cos(a))]);
    for(const j of [0,2,1,0,3,2])p.push(...points[j]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
}
// Keep the CAD/source meshes for identity and selection. Only their render copy
// is replaced where exported material batches include movable visual details.
function withoutTriangles(object,remove){
  const source=object.geometry,index=source.index,position=source.attributes.position,keep=[];
  object.updateWorldMatrix(true,false);
  for(let i=0;i<(index?.count||position.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const center=new THREE.Vector3();for(const id of ids)center.add(vec.fromBufferAttribute(position,id));center.multiplyScalar(1/3).applyMatrix4(object.matrixWorld);
    if(!remove(center))keep.push(...ids);
  }
  const geometry=source.clone();geometry.setIndex(keep);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  object.geometry=geometry;source.dispose();
}
export class OperationsSimulation {
  constructor(viewer){
    this.viewer=viewer;this.time=0;this.speed=1;this.enabled=!viewer.reduced;this.flow=false;this.roots=[];this.oht=[];this.doors=[];this.fans=[];this.flowMeshes=[];this.pickables=[];
    this.white=M('#e8eeeb',.25,.3);this.steel=M('#8a9b9d',.65,.3);this.dark=M('#202c31',.2,.65);this.amber=M('#a96d2b',.15,.26);this.teal=M('#176b68',.25,.35);this.yellow=M('#e1a629',.1,.35);
    this.green=new THREE.MeshBasicMaterial({color:'#78ffc2',toneMapped:false});this.red=new THREE.MeshBasicMaterial({color:'#e95342',toneMapped:false});
    this.prepareSource();this.buildOHT();this.buildFans();this.buildSignals();this.buildTraffic();this.buildDoors();this.buildFlow();this.update(0);this.syncVisibility();
  }
  group(floor,system,flow=false){const root=node(this.viewer.groups.get(floor));root.name=`Operations_${floor}_${system}`;root.userData.operationSystem=system;this.roots.push({root,system,flow});return root;}
  bindAsset(id,root,data){
    let entry=this.viewer.assetMap.get(id);
    if(!entry&&data){entry={data:{id,...data},objects:[]};this.viewer.assetMap.set(id,entry);}
    if(!entry)return;if(id.startsWith('VIS:OHT-AS3-')){entry.data.sourceSystem??=entry.data.system;entry.data.system='OHT';}entry.objects=[];
    root.traverse(o=>{if(o.isMesh){o.userData.viewerAssetId=id;o.userData.viewerGroup=entry.data.floor;entry.objects.push(o);this.pickables.push(o);}});
  }
  prepareSource(){
    for(const o of this.viewer.meshes){
      const name=this.viewer.assetMap.get(o.userData.viewerAssetId)?.data.sourceObject||o.name.replace(/001$/,'');
      if(/^OHT-AS3-/.test(name)||/^ARCH_Loading_door_/.test(name)){o.userData.operationReplaced=true;o.userData.viewerDynamic=true;o.visible=false;}
      if(name.includes('Facade_A_dark'))withoutTriangles(o,p=>p.z>.48&&p.z<.53&&p.y>.35&&p.y<4.85&&[20,38,56,74,92].some(x=>Math.abs(p.x-x)<2.5));
      if(name.startsWith('Detail_F1_OHT_Detail_'))withoutTriangles(o,p=>p.y<19.5);
      if(/^Detail_F1_Process_Detail_(green|amber|red)$/.test(name))withoutTriangles(o,p=>p.y>17.86&&p.y<18.09&&(Math.abs(p.x-43.03)<.055||Math.abs(p.x-46.97)<.055));
    }
  }
  buildOHT(){
    const configs=[{x:43.535,a:-33.67,b:-28.45,offset:0,id:'OHT-AS3-01'},{x:46.465,a:-39.47,b:-34.25,offset:29,id:'OHT-AS3-02'},{x:43.535,a:-20.77,b:-15.55,offset:57,id:'OHT-AS3-03'}];
    for(const c of configs){
      const root=this.group('F1','OHT'),body=node(root),payload=node(root),hoist=node(root);
      box(body,this.white,[0,19.41,0],[.69,.3,.95]);box(body,this.dark,[0,19.24,0],[.58,.10,.83]);
      box(body,this.teal,[.35,19.42,0],[.015,.11,.65]);
      for(const x of [-.28,.28])box(body,this.steel,[x,19.52,0],[.05,.05,.78]);
      const lamp=box(body,this.green.clone(),[.357,19.44,.28],[.02,.055,.18]);
      box(payload,this.amber,[0,0,0],[.42,.42,.48]);box(payload,this.dark,[c.x<45?.217:-.217,0,0],[.025,.37,.435]);
      box(payload,this.steel,[0,.23,0],[.16,.03,.20]);box(payload,this.dark,[0,.265,0],[.09,.045,.13]);
      for(let j=0;j<7;j++)box(payload,this.steel,[-.212,-.145+j*.045,0],[.012,.012,.39]);
      box(hoist,this.steel,[0,0,0],[.3,.055,.32]);
      const belts=[-.13,.13].map(x=>box(root,this.dark,[c.x+x,19,0],[.018,.1,.038]));
      mergeParts(body);mergeParts(payload);this.bindAsset(`VIS:${c.id}_drive`,body);this.bindAsset(`VIS:${c.id}_payload_FOUP_shell`,payload);this.oht.push({...c,root,body,payload,hoist,belts,lamp});
    }
  }
  fanArray(floor,system,positions,radius){
    const root=this.group(floor,system),uniform={value:0};
    const mat=new THREE.MeshStandardMaterial({color:'#9fb3b8',metalness:.55,roughness:.4,side:THREE.DoubleSide});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.operationTime=uniform;
      shader.vertexShader='uniform float operationTime;\n'+shader.vertexShader;
      const rotation='float angle=operationTime*7.0+instanceMatrix[3].x*.19; float cs=cos(angle), sn=sin(angle); mat3 spin=mat3(cs,0.,-sn,0.,1.,0.,sn,0.,cs);';
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n'+rotation+'\nobjectNormal=spin*objectNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=spin*transformed;');
    };
    mat.customProgramCacheKey=()=> 'operation-rotor-v1';
    const fans=new THREE.InstancedMesh(rotorGeometry(radius),mat,positions.length);fans.userData.viewerDynamic=true;root.add(fans);
    positions.forEach((p,i)=>{matrix.makeTranslation(...p);fans.setMatrixAt(i,matrix);});fans.instanceMatrix.needsUpdate=true;fans.computeBoundingSphere();
    this.fans.push({mesh:fans,uniform,count:positions.length});
    if(floor==='RF'){
      const inlets=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius*.98,radius*.98,.008,24),this.dark,positions.length);inlets.userData.viewerDynamic=true;root.add(inlets);
      positions.forEach((p,i)=>{matrix.makeTranslation(p[0],p[1]-.008,p[2]);inlets.setMatrixAt(i,matrix);});inlets.computeBoundingSphere();
      const rings=new THREE.InstancedMesh(new THREE.TorusGeometry(radius*1.04,.035,6,32).rotateX(Math.PI/2),this.steel,positions.length);rings.userData.viewerDynamic=true;root.add(rings);
      const bars=new THREE.InstancedMesh(boxGeo,this.dark,positions.length*2);bars.userData.viewerDynamic=true;root.add(bars);
      positions.forEach((p,i)=>{matrix.makeTranslation(...p);rings.setMatrixAt(i,matrix);for(let j=0;j<2;j++){matrix.compose(new THREE.Vector3(p[0],p[1]+.08,p[2]),identity,new THREE.Vector3(j?.035:radius*2.1,.035,j?radius*2.1:.035));bars.setMatrixAt(i*2+j,matrix);}});
      rings.computeBoundingSphere();bars.computeBoundingSphere();
    }
  }
  buildFans(){this.fanArray('F2','FFU',layout.ffu,.211);this.fanArray('RF',this.viewer.assetMap.get('FAB1:Exhaust_Fans')?.data.system||'Equipment',layout.roof,.59);}
  buildSignals(){
    const root=this.group('F1','Equipment detail');this.signalPositions=[];
    for(const [side,u0]of [[-1,6.8],[1,1]])for(let u=u0;u+3.5<=33.3+1e-6;u+=4.3)this.signalPositions.push([45+side*1.97,17.9,-(42-u-.23)]);
    this.signals=[0,1,2].map(k=>{
      const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.040,.040,.065,12),new THREE.MeshBasicMaterial({toneMapped:false}),this.signalPositions.length);mesh.userData.viewerDynamic=true;root.add(mesh);
      this.signalPositions.forEach((p,i)=>{matrix.makeTranslation(p[0],p[1]+k*.073,p[2]);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new THREE.Color('#101c1a'));});mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);mesh.computeBoundingSphere();return mesh;
    });
  }
  buildTraffic(){
    const root=this.group('site','Architecture'),truck=node(root),wheels=[];
    box(truck,this.dark,[0,.68,0],[2.35,.26,6.8]);box(truck,this.white,[0,2.02,-.9],[2.3,2.25,4.8]);
    box(truck,this.teal,[0,1.56,2.3],[2.25,1.65,1.65]);box(truck,this.dark,[0,1.98,3.14],[1.91,.72,.03]);
    box(truck,this.steel,[0,.82,3.18],[2.3,.2,.18]);
    for(const x of [-1.14,1.14]){box(truck,this.dark,[x,2.01,2.35],[.026,.66,1.1]);box(truck,this.steel,[x*1.12,1.9,2.86],[.19,.3,.08]);
      for(const z of [-2.4,2.15]){
        const wheel=node(truck);wheel.position.set(x,.5,z);
        part(wheel,new THREE.CylinderGeometry(.48,.48,.25,20).rotateZ(Math.PI/2),this.dark);
        part(wheel,new THREE.CylinderGeometry(.26,.26,.28,12).rotateZ(Math.PI/2),this.steel);
        box(wheel,this.dark,[x>0?.15:-.15,0,0],[.018,.42,.06]);wheels.push(wheel);
      }
    }
    this.brakeMaterial=new THREE.MeshBasicMaterial({color:'#e84d37',toneMapped:false});
    for(const x of [-.83,.83]){box(truck,new THREE.MeshBasicMaterial({color:'#fff3d0',toneMapped:false}),[x,1.06,3.15],[.28,.18,.04]);box(truck,this.brakeMaterial,[x,1.02,-3.32],[.19,.28,.04]);}
    this.beaconMaterial=new THREE.MeshBasicMaterial({color:'#ffc04d',toneMapped:false});part(truck,new THREE.CylinderGeometry(.1,.1,.14,12),this.beaconMaterial,[0,2.47,2.3]);
    for(const x of [-1.157,1.157]){box(truck,this.teal,[x,1.27,-.9],[.014,.11,4.55]);for(let j=0;j<9;j++)box(truck,this.steel,[x,2.08,-2.95+j*.5],[.014,1.98,.015]);}
    box(truck,this.dark,[0,1.98,-3.312],[.016,2.15,.016]);
    for(const x of [-.54,.54])box(truck,this.steel,[x,1.96,-3.322],[.025,1.95,.022]);
    mergeParts(truck);this.bindAsset('SIM:LOGISTICS_TRUCK',truck,{label:'廠區配送車（運轉示意）',floor:'site',system:'Architecture',sourceCollection:'Operational demonstration',DesignStatus:'Assumed demonstration vehicle; no commissioned equipment ID'});this.truck={root:truck,wheels};this.gates=[];
    for(const z of [23.5,36.5]){
      const inbound=z<30,base=node(root);base.position.set(20,0,z);
      box(base,this.yellow,[0,.63,0],[.65,1.26,.6]);const pivot=node(base);pivot.position.y=1.13;
      const direction=inbound?1:-1;
      box(pivot,this.white,[0,0,direction*2.65],[.12,.16,5.3]);
      for(let j=0;j<7;j++)box(pivot,this.red,[.066,0,direction*(.4+j*.7)],[.012,.16,.3]);
      const signalMat=new THREE.MeshBasicMaterial({color:'#d63d2e',toneMapped:false});const light=part(base,new THREE.SphereGeometry(.11,10,8),signalMat,[0,1.4,0]);
      mergeParts(pivot);this.gates.push({pivot,direction,light});
    }
    // Painted stop lines, lane arrows and detectors are visual operating assumptions.
    for(const [x,z]of [[16.6,26],[23.4,34]])box(root,this.white,[x,.015,z],[.22,.02,4.6]);
  }
  buildDoors(){
    const root=this.group('shell','Architecture');
    for(let i=0;i<5;i++){
      const x=20+18*i;
      box(root,this.dark,[x,2.5,.415],[4.98,4.98,.025]);
      const curtain=node(root);box(curtain,this.steel,[0,-2.5,0],[5,5,.10]);
      for(let k=0;k<20;k++)box(curtain,this.dark,[0,-.12-k*.25,.057],[4.96,.014,.012]);
      curtain.position.set(x,5,.46);box(root,this.white,[x,5.2,.48],[5.38,.36,.5]);
      const mat=new THREE.MeshBasicMaterial({color:'#5df5a6',toneMapped:false});part(root,new THREE.SphereGeometry(.08,10,8),mat,[x+2.67,3,.6]);
      mergeParts(curtain);this.bindAsset(`VIS:ARCH_Loading_door_${String(i).padStart(2,'0')}`,curtain);this.doors.push({curtain,mat,offset:i*9});
    }
  }
  flowArray(floor,system,paths,color){
    const root=this.group(floor,system,true),mesh=new THREE.InstancedMesh(new THREE.ConeGeometry(.043,.18,5).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.85,toneMapped:false}),paths.length*5);
    mesh.userData.viewerDynamic=true;mesh.renderOrder=5;mesh.frustumCulled=false;root.add(mesh);this.flowMeshes.push({mesh,paths});
  }
  buildFlow(){
    this.flowArray('F1','Piping',layout.pipes.filter(p=>p.b-p.a>5).map(p=>({a:[p.x,p.y,p.returnFlow?p.b:p.a],b:[p.x,p.y,p.returnFlow?p.a:p.b]})),'#21bdf1');
    const paths=[];for(const y of [11,18,33,39.5])for(let j=0;j<2;j++){
      const a=[40.72,-7.2+.32+j*.12,-y+.42+j*.15],b=[41.82,a[1],a[2]];paths.push(j?{a:b,b:a}:{a,b});
    }
    this.flowArray('B1','Piping',paths,'#24cde6');
    // Airflow is an explanatory overlay above the intake, not a CFD solution.
    this.flowArray('F2','FFU',layout.ffu.filter(p=>p[0]>42&&p[0]<48&&p[2]<-18&&p[2]>-26).map(p=>({a:[p[0],p[1]+.9,p[2]],b:[p[0],p[1]+.05,p[2]]})),'#4aa7eb');
  }
  setEnabled(value){this.enabled=Boolean(value);this.viewer.lastTick=undefined;this.viewer.dirty=2;}
  setSpeed(value){if([.5,1,2].includes(Number(value)))this.speed=Number(value);}
  setFlow(value){this.flow=Boolean(value);this.update(this.time);this.syncVisibility();this.viewer.dirty=2;}
  syncVisibility(){
    for(const {root,system,flow}of this.roots)root.visible=(!flow||this.flow)&&(this.viewer.system==='ALL'||this.viewer.system===system);
    for(const o of this.viewer.meshes)if(o.userData.operationReplaced)o.visible=false;
  }
  advance(dt){if(!this.enabled)return;this.time+=Math.max(0,Math.min(dt,.1))*this.speed;this.update(this.time);}
  seek(time){this.time=Math.max(0,Number(time)||0);this.update(this.time);this.viewer.dirty=2;}
  update(time){
    for(const c of this.oht){
      const s=ohtState(time+c.offset,c.a,c.b);c.state=s;c.lamp.material.color.set(s.travel?'#78ffc2':cycle(time,1)<.5?'#ffc04d':'#47371d');
      c.body.position.set(c.x,0,s.z);c.payload.position.set(c.x,s.payloadY,s.z);c.hoist.position.set(c.x,s.hoistY+.305,s.z);
      const top=19.19,bottom=s.hoistY+.33,length=Math.max(.015,top-bottom);
      c.belts.forEach((belt,i)=>{belt.position.set(c.x+(i? .13:-.13),(top+bottom)/2,s.z);belt.scale.y=length;});
    }
    for(const f of this.fans)f.uniform.value=time;
    const running=new THREE.Color('#64ffc0'),waiting=new THREE.Color('#ffb82d'),off=new THREE.Color('#152822');
    this.signalPositions.forEach((_,i)=>{
      const active=i===0||i===1?this.oht[0].state:i===6||i===7?this.oht[1].state:i===3||i===4?this.oht[2].state:null;
      const transfer=active&&!active.travel&&active.phase!=='機台接收・等待';
      this.signals[0].setColorAt(i,transfer?off:running);this.signals[1].setColorAt(i,transfer&&cycle(time,1)<.5?waiting:off);this.signals[2].setColorAt(i,off);
    });this.signals.forEach(m=>m.instanceColor.needsUpdate=true);
    const truck=truckState(time);this.traffic=truck;this.truck.root.position.set(truck.x,0,truck.z);this.truck.root.rotation.y=truck.heading;
    for(const w of this.truck.wheels)w.rotation.x=(Math.floor(time/TRUCK_PERIOD)*ROAD_LENGTH+truck.distance)/.48;
    this.brakeMaterial.color.set(truck.moving?'#76281f':'#ff4d31');this.beaconMaterial.color.set(cycle(time,1)<.5?'#ffc04d':'#573e1b');
    this.gates.forEach((g,i)=>{const opening=i?truck.exit:truck.entry;g.pivot.rotation.x=-g.direction*opening*Math.PI/2;g.light.material.color.set(opening>.999?'#67ffb8':'#e34f38');});
    this.doors.forEach(d=>{const opening=doorOpening(time,d.offset);d.curtain.scale.y=Math.max(.001,1-opening);d.curtain.visible=opening<.999;d.mat.color.set(opening>.999?'#68ffbb':cycle(time,1)<.5?'#ffb52d':'#573e1b');});
    if(this.flow)for(const {mesh,paths}of this.flowMeshes){paths.forEach((path,i)=>{
      const a=new THREE.Vector3(...path.a),b=new THREE.Vector3(...path.b),direction=b.clone().sub(a).normalize(),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
      for(let j=0;j<5;j++){const p=a.clone().lerp(b,cycle(time*.18+j/5,1));matrix.compose(p,q,new THREE.Vector3(1,1,1));mesh.setMatrixAt(i*5+j,matrix);}
    });mesh.instanceMatrix.needsUpdate=true;}
  }
  snapshot(){return{enabled:this.enabled,time:this.time,speed:this.speed,flow:this.flow,oht:this.oht.map(c=>({id:c.id,x:c.x,...c.state})),traffic:this.traffic,doors:this.doors.map(d=>doorOpening(this.time,d.offset)),fans:this.fans.map(f=>({count:f.count,phase:f.uniform.value*7})),visibleGroups:this.roots.filter(r=>this.viewer.visible(r.root)).map(r=>r.root.name)};}
}
