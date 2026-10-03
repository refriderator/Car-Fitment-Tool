const fs=require('fs'),zlib=require('zlib');const {MeshoptSimplifier:S}=require('meshoptimizer');
const TARGET={paint:60000,trim:34000,light:9000,metal:7000,glass:5000}, ERR={paint:0.0012,trim:0.0035,light:0.01,metal:0.01,glass:0.004};
(async()=>{await S.ready;
for(const car of process.argv.slice(2)){
  const meta=JSON.parse(fs.readFileSync(`tmp/${car}_meta.json`));const mn=meta.bbox[0],mx=meta.bbox[1],size=mx.map((v,i)=>v-mn[i]);
  const chunks=[],groups=[];let total=0;
  for(const g of ['paint','trim','light','metal','glass']){ if(!meta.groups[g]) continue;
    const rd=(e,T)=>{const b=fs.readFileSync(`tmp/${car}_${g}.${e}`);return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
    let pos=rd('pos',Float32Array),nrm=rd('nrm',Float32Array);let idx=rd('idx',Uint32Array);const n0=idx.length/3;
    { // weld vertices that share a position and a normal
      const key=new Map(), remap=new Uint32Array(pos.length/3); let n=0; const np=[],nn2=[];
      for(let v=0;v<pos.length/3;v++){ const k=Math.round(pos[v*3]*20000)+','+Math.round(pos[v*3+1]*20000)+','+Math.round(pos[v*3+2]*20000)+','+Math.round(nrm[v*3]*8)+','+Math.round(nrm[v*3+1]*8)+','+Math.round(nrm[v*3+2]*8);
        let id=key.get(k); if(id===undefined){id=n++;key.set(k,id);np.push(pos[v*3],pos[v*3+1],pos[v*3+2]);nn2.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);} remap[v]=id; }
      for(let i=0;i<idx.length;i++) idx[i]=remap[idx[i]];
      var pos2=new Float32Array(np), nrm2=new Float32Array(nn2); }
    pos=pos2; nrm=nrm2;
    const tgt=TARGET[g]*3;
    if(idx.length>tgt && true){ let [out,err]=S.simplify(idx,pos,3,tgt,ERR[g]);
      if(out.length>tgt*1.5 && g!=='paint' && g!=='trim'){ [out,err]=S.simplify(idx,pos,3,tgt,0.03); }
      if(out.length>tgt*1.8 && g!=='paint' && g!=='trim'){ const r=S.simplifySloppy(idx,pos,3,null,tgt,0.05); if(r[0].length>300) out=r[0]; }
      idx=out; }
    // compact
    const map=new Int32Array(pos.length/3).fill(-1);let nv=0;const nidx=new Uint32Array(idx.length);
    for(let i=0;i<idx.length;i++){let v=idx[i];if(map[v]<0)map[v]=nv++;nidx[i]=map[v];}
    const q=new Uint16Array(nv*3),nn=new Int8Array(nv*3);
    for(let v=0;v<map.length;v++){const m=map[v];if(m<0)continue;for(let k=0;k<3;k++){q[m*3+k]=Math.max(0,Math.min(65535,Math.round((pos[v*3+k]-mn[k])/size[k]*65535)));nn[m*3+k]=Math.max(-127,Math.min(127,Math.round(nrm[v*3+k]*127)));}}
    const ib=nv<65536?new Uint16Array(nidx):nidx;
    groups.push({name:g,nv,ni:nidx.length,i32:nv>=65536});total+=nidx.length/3;
    for(const a of [q,nn,ib]){let b=Buffer.from(a.buffer,a.byteOffset,a.byteLength);chunks.push(b);const pad=(4-b.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));}
    console.log(car,g,n0,'->',nidx.length/3,'tris',nv,'verts');
  }
  const raw=Buffer.concat(chunks),gz=zlib.gzipSync(raw,{level:9});
  const out={id:car,min:mn,size,groups,wheelsModel:meta.wheelsModel,rawBytes:raw.length,gz:gz.toString('base64')};
  fs.mkdirSync('cars',{recursive:true});fs.writeFileSync(`cars/${car}.json`,JSON.stringify(out));
  console.log(car,'total tris',total,'raw',raw.length,'gz',gz.length,'json',fs.statSync(`cars/${car}.json`).size);
}})();
