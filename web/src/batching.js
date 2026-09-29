import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original objects stay available for selection and metadata. Only the render
// representation is merged, within one floor/system/material/visibility region.
export async function batchStaticMeshes(viewer) {
  const batches=[];
  viewer.scene.updateMatrixWorld(true);
  for(const [floor,root] of viewer.groups){
    const inverse=root.matrixWorld.clone().invert();
    const buckets=new Map();
    for(const object of viewer.meshes){
      if(object.userData.viewerGroup!==floor||object.userData.viewerDynamic)continue;
      const material=object.material,geometry=object.geometry;
      if(Array.isArray(material)||material.transparent||material.transmission>0||object.isSkinnedMesh||Object.keys(geometry.morphAttributes).length)continue;
      const matrix=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
      // Mirrored geometry must retain its original winding/render path.
      if(matrix.determinant()<0)continue;
      geometry.computeBoundingBox();
      const center=geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
      const asset=viewer.assetMap.get(object.userData.viewerAssetId).data;
      const collection=asset.sourceCollection||'';
      const visibility=asset.displayMode||object.userData.displayMode||'always';
      const special=['Site_Cutaway','Site_FullGround','Facade_B_Openable'].filter(s=>collection.includes(s)).join(',');
      const signature=Object.entries(geometry.attributes).map(([k,a])=>`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join('|');
      const key=[material.uuid,asset.system,visibility,special,Math.floor(center.x/40),Math.floor(center.z/40),!!geometry.index,signature].join(';');
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push({object,matrix});
    }
    let count=0;
    for(const entries of buckets.values()){
      if(viewer.dead)return batches;
      if(entries.length<2)continue;
      const copies=entries.map(({object,matrix})=>object.geometry.clone().applyMatrix4(matrix));
      const geometry=mergeGeometries(copies,false);
      copies.forEach(g=>g.dispose());
      if(!geometry)continue;
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,entries[0].object.material);
      mesh.name=`RenderBatch_${floor}_${count++}`;
      mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.userData.viewerBatch=true;
      const originals=entries.map(e=>e.object);
      originals.forEach(o=>o.layers.set(1));
      root.add(mesh);
      batches.push({mesh,originals});
      // Let input/layout work proceed while preparing the static render buffers.
      if(count%8===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  return batches;
}
