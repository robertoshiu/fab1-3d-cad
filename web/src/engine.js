import * as THREE from 'three';
import { OperationsSimulation, OPERATION_VIEWS } from './operations.js';
import { batchStaticMeshes } from './batching.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

THREE.Cache.enabled = true;
const url = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const V = (p) => new THREE.Vector3(...p);
const FLOOR_Z = { B1: -7.2, F1: 15.4, F2: 29.6, RF: 41.8 };
const FALLBACK_SHOTS = {
  HERO: { position: [425,155,315], target: [125,18,-45], fov: 39.6 },
  EXTERIOR: { position: [398,195,365], target: [125,23,-45], fov: 39.6 },
  CLEANROOM: { position: [45,17.1,-41], target: [45,17.3,-23.5], fov: 64 },
  B1: { position: [44.1,-5.2,-30.4], target: [41.6,-6.55,-33.05], fov: 53 },
  PLENUM: { position: [109,31.6,-15], target: [105,30.35,-48], fov: 64 },
  ROOF: { position: [35,48.2,-11], target: [45,44.3,-20], fov: 54 },
};

export class TwinViewer {
  constructor({host,onLoad,onProgress,onSelect,onInteract,onError}) {
    Object.assign(this,{host,onLoad,onProgress,onSelect,onInteract,onError});
    this.groups=new Map(); this.assetMap=new Map(); this.meshes=[];this.materialCache=new Map();
    this.quality='auto';this.mobile=matchMedia('(pointer: coarse)').matches||innerWidth<768;this.batches=[];this.fastMaterials=new Map();
    this.floor='ALL'; this.cutaway=true; this.exploded=false; this.system='ALL';
    this.dead=false; this.preparing=true; this.dirty=5; this.tween=null; this.pointerDown=null;
    this.motionMedia=matchMedia('(prefers-reduced-motion: reduce)');this.reduced=this.motionMedia.matches;
    this.abort=new AbortController(); this.listeners=[]; this.started=performance.now();
  }
  async init() {
    try {
      const response=await fetch(url('model-manifest.json'),{signal:this.abort.signal});
      if(!response.ok) throw new Error('模型清單尚未載入成功');
      this.manifest=await response.json();
      if(this.dead)return;
      this.scene=new THREE.Scene(); this.scene.background=new THREE.Color('#e3e9e9');
      this.camera=new THREE.PerspectiveCamera(40,1,.05,5000);
      this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.transmissionResolutionScale=.5;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure=.8;
      this.renderer.shadowMap.enabled=true;
      this.renderer.shadowMap.type=THREE.PCFShadowMap;
      this.renderer.shadowMap.autoUpdate=false;
      const canvas=this.renderer.domElement;
      canvas.setAttribute('aria-label','FAB-1 互動三維模型，拖曳旋轉、滾輪縮放，方向鍵平移');
      canvas.setAttribute('tabindex','0'); canvas.style.touchAction='none';
      this.host.appendChild(canvas);
      this.controls=new OrbitControls(this.camera,canvas);
      this.controls.enableDamping=true; this.controls.dampingFactor=.08;
      this.controls.minDistance=.6; this.controls.maxDistance=2500;
      this.controls.maxPolarAngle=Math.PI*.93; this.controls.screenSpacePanning=true;
      this.controls.listenToKeyEvents(canvas);
      this.controls.addEventListener('change',()=>{this.dirty=3;});
      this.controls.addEventListener('start',()=>{this.cancelMove(); this.onInteract?.();});
      this.controls.addEventListener('end',()=>{this.dirty=30;});
      this.scene.add(new THREE.HemisphereLight(0xeaf2ff,0xbcc2c0,.65));
      this.scene.add(new THREE.AmbientLight(0xffffff,.12));
      this.sun=new THREE.DirectionalLight(0xfff6e8,1.6);
      this.sun.position.set(100,240,130); this.sun.target.position.set(125,10,-45);
      this.sun.castShadow=true; this.sun.shadow.mapSize.set(2048,2048);
      Object.assign(this.sun.shadow.camera,{left:-180,right:180,top:120,bottom:-120,near:.5,far:600});
      this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025;
      this.scene.add(this.sun,this.sun.target);
      const fill=new THREE.DirectionalLight(0xcde4ff,.45); fill.position.set(220,120,-150);this.scene.add(fill);
      const pmrem=new THREE.PMREMGenerator(this.renderer);
      const room=new RoomEnvironment();
      this.envTarget=pmrem.fromScene(room,.04);this.scene.environment=this.envTarget.texture;room.dispose();
      this.pmrem=pmrem;
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(10000,10000),new THREE.MeshStandardMaterial({color:0x9ba9aa,roughness:.95}));
      ground.rotation.x=-Math.PI/2;ground.position.set(125,-13,-45);ground.receiveShadow=true;ground.name='ViewerGround';this.scene.add(ground);this.ground=ground;
      this.selection=new THREE.Box3Helper(new THREE.Box3(),0x008875);this.selection.visible=false;this.scene.add(this.selection);
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.host);
      this.resize();this.goToShot('HERO',0);
      this.listen(this.motionMedia,'change',e=>{this.reduced=e.matches;if(e.matches){this.cancelMove();this.operations?.setEnabled(false);}});
      this.listen(canvas,'keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){this.cancelMove();this.onInteract?.();}});
      this.listen(canvas,'pointerdown',e=>{this.pointerDown={x:e.clientX,y:e.clientY,time:performance.now(),button:e.button};});
      this.listen(canvas,'pointerup',e=>{
        const p=this.pointerDown;this.pointerDown=null;
        if(p&&p.button===0&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<5&&performance.now()-p.time<650)this.pick(e);
      });
      this.listen(canvas,'webglcontextlost',e=>{e.preventDefault();this.onError?.('圖形顯示已中斷，請重新載入模型。');});
      this.loop();
      this.draco=new DRACOLoader();this.draco.setDecoderPath(url('models/draco/'));this.draco.setWorkerLimit(2);
      const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);loader.setDRACOLoader(this.draco);
      // Files stay separate by floor. The loading report counts completed files and
      // the current file's bytes, without pretending GPU preparation is finished.
      const order=['shell','site','RF','F1','B1','F2'];
      const records=[...this.manifest.groups].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
      let loaded=0;
      for(const record of records){
        if(this.dead)return;
        this.onProgress?.({loaded,total:records.length,label:record.id,ratio:loaded/records.length});
        const gltf=await loader.loadAsync(url(record.url),e=>this.onProgress?.({loaded,total:records.length,label:record.id,ratio:(loaded+(e.total?e.loaded/e.total:0))/records.length}));
        if(this.dead){this.disposeTree(gltf.scene);return;}
        const root=gltf.scene;root.name=`FloorGroup_${record.id}`;this.groups.set(record.id,root);this.scene.add(root);
        root.traverse(obj=>{
          if(!obj.isMesh)return;
          obj.castShadow=true;obj.receiveShadow=true;
          let node=obj;
          while(node.parent && !node.userData.assetId && !node.userData.stable_id)node=node.parent;
          const meta={...node.userData,...obj.userData};
          const id=meta.assetId||meta.stable_id||`detail:${obj.name}`;
          const asset={...meta,id,label:meta.label||meta.Label||obj.name.replace(/^CAD_+/,'').replaceAll('_',' '),floor:meta.floor||record.id,system:meta.system||meta.System||'建築與構造',sourceCollection:meta.sourceCollection||'',objectName:obj.name};
          obj.userData.viewerAssetId=id;obj.userData.viewerGroup=record.id;
          let entry=this.assetMap.get(id);
          if(!entry){entry={data:asset,objects:[]};this.assetMap.set(id,entry);}entry.objects.push(obj);
          this.meshes.push(obj);
          const reuse=mat=>{const key=mat.name;if(this.materialCache.has(key))return this.materialCache.get(key);this.materialCache.set(key,mat);return mat;};
          obj.material=Array.isArray(obj.material)?obj.material.map(reuse):reuse(obj.material);
          for(const mat of(Array.isArray(obj.material)?obj.material:[obj.material])){
            mat.envMapIntensity=.5;
            // Double-sided transparency is costly and surfaces already have thickness.
            if(mat.map)mat.map.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
          }
        });
        loaded++;this.applyVisibility();this.dirty=4;
      }
      this.assets=[...this.assetMap.values()].map(e=>e.data);
      this.operations=new OperationsSimulation(this);
      this.assets=[...this.assetMap.values()].map(e=>e.data);
      this.onProgress?.({loaded:records.length,total:records.length,label:'正在整理設備繪圖資料',ratio:.96});
      this.batches=await batchStaticMeshes(this);
      if(this.dead)return;
      this.applyVisibility();this.setQuality(this.quality);
      this.onProgress?.({loaded:records.length,total:records.length,label:'正在準備材質與光影',ratio:.98});
      await this.loadEnvironment();
      if(this.dead)return;
      await this.renderer.compileAsync(this.scene,this.camera);
      if(this.dead)return;
      this.preparing=false;
      this.loadedMs=performance.now()-this.started;
      this.onProgress?.({loaded,total:records.length,label:'完成',ratio:1});
      this.onLoad?.({manifest:this.manifest,assets:this.assets,systems:[...new Set(this.assets.map(a=>a.system))].sort()});
      this.dirty=2;
    }catch(error){if(!this.dead&&error.name!=='AbortError'){console.error(error);this.onError?.(error.message||'無法載入模型');}}
  }
  async loadEnvironment(){
    try{
      const hdr=await new HDRLoader().loadAsync(url(this.manifest.environment?.url||'textures/environment.hdr'));
      if(this.dead){hdr.dispose();return;}
      const env=this.pmrem.fromEquirectangular(hdr);this.envTarget.dispose();this.envTarget=env;
      this.scene.environment=env.texture;hdr.dispose();this.dirty=4;
    }catch(e){console.warn('使用本機展廳環境光',e.message);}
  }
  listen(target,event,fn){target.addEventListener(event,fn);this.listeners.push(()=>target.removeEventListener(event,fn));}
  resize(){if(!this.renderer)return;const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.dirty=3;}
  setQuality(value){
    this.quality=['auto','detail','smooth'].includes(value)?value:'auto';
    const smooth=this.quality==='smooth'||(this.quality==='auto'&&this.mobile);
    this.effectiveQuality=smooth?'smooth':'detail';
    if(!this.renderer)return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,smooth?1:1.5));
    this.renderer.shadowMap.enabled=!smooth;
    this.renderer.shadowMap.needsUpdate=true;
    for(const original of this.materialCache.values()){
      if(!this.fastMaterials.has(original)){
        const light=original.clone();
        if(light.transmission>0){light.transmission=0;light.transparent=true;light.opacity=.26;light.depthWrite=false;}
        if('anisotropy' in light)light.anisotropy=0;
        if('clearcoat' in light)light.clearcoat=0;
        light.normalMap=null;light.needsUpdate=true;
        this.fastMaterials.set(original,light);
      }
    }
    for(const object of [...this.meshes,...this.batches.map(b=>b.mesh)]){
      object.userData.originalMaterial??=object.material;
      const original=object.userData.originalMaterial;
      object.material=smooth?(this.fastMaterials.get(original)||original):original;
    }
    this.resize();this.dirty=3;
  }
  setTheme(theme){if(!this.scene)return;this.scene.background.set(theme==='dark'?'#28393d':'#e3e9e9');this.ground.material.color.set(theme==='dark'?'#697a7c':'#9ba9aa');this.dirty=3;}
  setFloor(floor){this.floor=floor;this.system='ALL';this.exploded=false;this.clearSelection();this.applyVisibility();if(floor==='ALL')this.goToShot('HERO');else this.frameFloor(floor);}
  setCutaway(value){this.cutaway=Boolean(value);this.applyVisibility();}
  setExploded(value){this.exploded=Boolean(value);this.clearSelection();this.applyVisibility();if(value)this.move([405,235,355],[125,57,-45],42,1400);else if(this.floor==='ALL')this.goToShot('HERO');}
  setSystem(value){this.system=value;this.clearSelection();this.applyVisibility();}
  applyVisibility(){
    for(const [key,root]of this.groups){
      root.visible=this.floor==='ALL'||key===this.floor;
      if((key==='shell'||key==='site')&&this.floor!=='ALL')root.visible=false;
      if(this.exploded&&key==='shell')root.visible=false;
      root.position.y=this.exploded?({B1:0,F1:14,F2:28,RF:42}[key]||0):0;
      root.traverse(o=>{
        if(!o.isMesh||o.userData.viewerBatch||o.userData.viewerDynamic)return;
        const asset=this.assetMap.get(o.userData.viewerAssetId)?.data;
        const collection=asset?.sourceCollection||'';
        const mode=o.userData.displayMode||asset?.displayMode;
        let visible=true;
        if(mode==='cutaway'||collection.includes('Site_Cutaway'))visible=this.cutaway;
        if(mode==='solid-ground'||collection.includes('Site_FullGround'))visible=!this.cutaway;
        if(collection.includes('Facade_B_Openable'))visible=!this.cutaway;
        if(this.system!=='ALL')visible=visible&&asset?.system===this.system;
        o.visible=visible;
      });
    }
    for(const batch of this.batches)batch.mesh.visible=batch.originals[0].visible;
    this.operations?.syncVisibility();
    if(this.renderer)this.renderer.shadowMap.needsUpdate=true;this.dirty=5;
  }
  frameFloor(floor){const y=FLOOR_Z[floor]||0;this.move([350,y+170,235],[125,y+2,-45],42,1400);}
  goToShot(key,duration=1800){
    const shot=this.manifest?.cameras?.[key]||FALLBACK_SHOTS[key]||FALLBACK_SHOTS.HERO;
    this.shot=key;
    this.move(shot.position,shot.target,shot.fov||40,duration);
  }
  move(position,target,fov=40,duration=1500){
    if(!this.camera)return;
    let p=V(position),t=V(target);
    // Keep the 250 m building readable within portrait viewports as well.
    if(p.distanceTo(t)>100&&this.camera.aspect<1.25)p=t.clone().add(p.sub(t).multiplyScalar(1.25/this.camera.aspect));
    if(this.reduced||duration===0){this.camera.position.copy(p);this.controls.target.copy(t);this.camera.fov=fov;this.camera.updateProjectionMatrix();this.controls.update();this.tween=null;this.dirty=4;return;}
    this.tween={start:performance.now(),duration,from:this.camera.position.clone(),to:p,fromTarget:this.controls.target.clone(),toTarget:t,fromFov:this.camera.fov,toFov:fov};
  }
  cancelMove(){this.tween=null;this.dirty=3;}
  visible(obj){for(let n=obj;n;n=n.parent)if(!n.visible)return false;return true;}
  pick(event){
    const bounds=this.renderer.domElement.getBoundingClientRect();const xy=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    const ray=new THREE.Raycaster();ray.layers.enable(1);ray.setFromCamera(xy,this.camera);
    const hit=ray.intersectObjects([...this.meshes,...(this.operations?.pickables||[])].filter(o=>this.visible(o)),false)[0];
    if(hit)this.selectAsset(hit.object.userData.viewerAssetId);else this.clearSelection();
  }
  selectAsset(id){
    const entry=this.assetMap.get(id);if(!entry)return;
    this.selected=id;this.scene.updateMatrixWorld(true);
    const box=new THREE.Box3();for(const obj of entry.objects)box.union(new THREE.Box3().setFromObject(obj));
    this.selection.box.copy(box.expandByScalar(.06));this.selection.visible=true;
    this.onSelect?.({...entry.data,bounds:{min:box.min.toArray(),max:box.max.toArray()}});this.dirty=4;
  }
  clearSelection(){this.selected=null;if(this.selection)this.selection.visible=false;this.onSelect?.(null);this.dirty=3;}
  focusAsset(id){
    const entry=this.assetMap.get(id);if(!entry)return;
    this.exploded=false;this.system='ALL';this.floor=FLOOR_Z[entry.data.floor]!==undefined?entry.data.floor:'ALL';this.applyVisibility();
    const col=entry.data.sourceCollection||'';if(col.includes('Facade_B_Openable')||col.includes('Site_FullGround'))this.cutaway=false;if(col.includes('Site_Cutaway'))this.cutaway=true;this.applyVisibility();
    this.selectAsset(id);const box=this.selection.box;const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());
    const span=Math.max(size.x,size.y,size.z,3);this.move(center.clone().add(new THREE.Vector3(1,.7,1).normalize().multiplyScalar(span*2.1)).toArray(),center.toArray(),48,1300);
  }
  focusOperation(key){
    const view=OPERATION_VIEWS[key];if(!view)return;
    this.cancelMove();this.clearSelection();this.floor=view.floor;this.system='ALL';this.exploded=false;this.cutaway=view.floor!=='ALL';this.applyVisibility();
    if(['AIR','UTILITIES'].includes(key))this.operations.setFlow(true);
    this.move(view.position,view.target,view.fov,1200);this.shot=key;
  }
  loop=()=>{
    if(this.dead)return;this.frame=requestAnimationFrame(this.loop);
    const now=performance.now();
    if(document.hidden){this.lastTick=undefined;return;}
    if(!this.preparing){
      const dt=this.lastTick===undefined?0:(now-this.lastTick)/1000;this.lastTick=now;
      this.operations?.advance(dt);
      if(this.operations?.enabled)this.dirty=Math.max(this.dirty,1);
    }
    const targetFrame=1000/(this.effectiveQuality==='smooth'?30:60);
    if(now-(this.lastRender||0)<targetFrame-.5)return;
    if(this.tween){const t=this.tween;const raw=Math.min(1,(performance.now()-t.start)/t.duration);const ease=raw*raw*(3-2*raw);this.camera.position.lerpVectors(t.from,t.to,ease);this.controls.target.lerpVectors(t.fromTarget,t.toTarget,ease);this.camera.fov=THREE.MathUtils.lerp(t.fromFov,t.toFov,ease);this.camera.updateProjectionMatrix();this.dirty=3;if(raw===1)this.tween=null;}
    this.controls?.update();
    if(this.dirty>0&&!this.preparing){const distance=this.camera.position.distanceTo(this.controls.target); const near=distance>100?Math.min(30,distance/40):.05;if(this.camera.near!==near){this.camera.near=near;this.camera.updateProjectionMatrix();}if(this.selected&&this.assetMap.get(this.selected)?.objects.some(o=>o.userData.viewerDynamic)){this.scene.updateMatrixWorld(true);this.selection.box.makeEmpty();for(const o of this.assetMap.get(this.selected).objects)this.selection.box.union(new THREE.Box3().setFromObject(o));this.selection.box.expandByScalar(.06);}
      this.renderer.render(this.scene,this.camera);this.lastRender=now;this.dirty--;this.frames=(this.frames||0)+1;}
  };
  getSnapshot(){return{operations:this.operations?.snapshot(),ready:!!this.assets&&!this.preparing&&!this.dead,quality:this.quality,effectiveQuality:this.effectiveQuality,pixelRatio:this.renderer?.getPixelRatio(),batches:this.batches.length,batchedObjects:this.batches.reduce((n,b)=>n+b.originals.length,0),floor:this.floor,system:this.system,cutaway:this.cutaway,exploded:this.exploded,shot:this.shot,selected:this.selected,groups:[...this.groups].map(([id,g])=>({id,visible:g.visible,offsetY:g.position.y})),assets:this.assets?.length||0,meshes:this.meshes.length,camera:this.camera?.position.toArray(),target:this.controls?.target.toArray(),drawCalls:this.renderer?.info.render.calls,triangles:this.renderer?.info.render.triangles,loadedMs:this.loadedMs,frames:this.frames,source:this.manifest?.source};}
  disposeTree(root){root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[])){for(const val of Object.values(m))if(val?.isTexture){val.source?.data?.close?.();val.dispose();}m.dispose();}});}
  dispose(){this.dead=true;this.abort.abort();cancelAnimationFrame(this.frame);this.listeners.forEach(fn=>fn());this.resizeObserver?.disconnect();this.controls?.dispose();if(this.scene)this.disposeTree(this.scene);this.envTarget?.dispose();this.pmrem?.dispose();this.draco?.dispose();for(const material of this.fastMaterials.values())material.dispose();for(const material of this.materialCache.values())material.dispose();this.renderer?.dispose();this.renderer?.domElement.remove();}
}
