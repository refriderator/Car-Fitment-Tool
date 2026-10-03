require('../src/core.js'); const F=globalThis.FIT, fs=require('fs'), zlib=require('zlib');
const fmt=v=>v==null?'-':(+v).toFixed(1);
// arithmetic checks
console.log('measuring rims', [[195,50],[205,55],[225,45],[245,40],[265,35],[215,40],[255,35],[215,45],[205,40],[235,35]].map(a=>a.join('/')+':'+F.measuringRim(a[0],a[1])).join('  '));
console.log('195/50R15 on 6J', JSON.stringify(F.wheelDims({d:15,j:6,et:40,tw:195,ar:50})));
console.log('215/40R18 on 7.5J', JSON.stringify(F.wheelDims({d:18,j:7.5,et:48,tw:215,ar:40})));
for(const id of process.argv.slice(2)){
  const car=F.CARS[id], json=JSON.parse(fs.readFileSync(car.file)); const raw=zlib.gunzipSync(Buffer.from(json.gz,'base64'));
  let t0=Date.now(); const mesh=F.decodeCar(json,new Uint8Array(raw.buffer,raw.byteOffset,raw.length));
  console.log('=====',id,car.name,'decode',Date.now()-t0,'ms; model wheel F',JSON.stringify(mesh.axle.F),'R',JSON.stringify(mesh.axle.R));
  for(const ax of ['F','R']){
    const a=mesh.axle[ax]; t0=Date.now(); const tris=F.regionTris(mesh,a.z,a.y); const map=F.buildMap(tris,a.z,a.y); const lip=F.lipProfile(map,a.rTyre+230);
    console.log(ax,'region tris',tris.length/9,'map ms',Date.now()-t0,'lip top x',fmt(lip.topX),'R',fmt(lip.topR),'theta',lip.thMin,lip.thMax);
    let s=''; for(let th=-30;th<=210;th+=15) s+=th+':'+fmt(lip.xAt(th))+'/'+fmt(lip.rAt(th))+'  '; console.log('   lip x/R by theta:',s);
    const spec=Object.assign({sp:0,arm:0},car.start[ax]); if(spec.rh==null) spec.rh=Math.round(lip.topR);
    const show=(tag,sp)=>{const r=F.fitAxle(car,ax,sp,map,lip,lip,0); console.log('   '+tag,JSON.stringify(sp),'\n      wc',r.corner.wc.map(fmt).join(','),'OD',fmt(r.dims.OD),'sec',fmt(r.dims.sec),'| poke',fmt(r.poke),'archGap',fmt(r.archGap),'lipGap',fmt(r.lipGap),r.lipWhere,'tucked',r.tucked,'travel',r.travel,r.travelWhere,'| lock',r.lock&&fmt(r.lock.g)+'@'+r.lock.at+' '+r.lock.where,'| outer',fmt(r.outerVsFactory),'inner',fmt(r.innerVsFactory),'track',fmt(r.track),r.verdict);};
    show('start  ',spec);
    show('factory',Object.assign({sp:0,arm:0,camber:0,rh:spec.rh},car.factory[ax]));
    show('lowered 40 + spacer 15',Object.assign({},spec,{rh:spec.rh-40,sp:15}));
  }
  // flare check
  const lips={}; for(const ax of ['F','R']){const a=mesh.axle[ax]; lips[ax]=F.lipProfile(F.buildMap(F.regionTris(mesh,a.z,a.y),a.z,a.y),a.rTyre+230);}
  t0=Date.now(); F.applyFlares(mesh,lips,{F:30,R:50},'pull'); const tf=Date.now()-t0;
  for(const ax of ['F','R']){const a=mesh.axle[ax]; const lip=F.lipProfile(F.buildMap(F.regionTris(mesh,a.z,a.y),a.z,a.y),a.rTyre+230); console.log('   flare',ax,'lip top x',fmt(lips[ax].topX),'->',fmt(lip.topX),'R',fmt(lips[ax].topR),'->',fmt(lip.topR),'(apply',tf,'ms)');}
  let mv=0,mx=0; for(const g of mesh.groups) for(let i=0;i<g.pos.length;i+=3){const d=Math.abs(g.pos[i]-g.base[i])*1000; if(d>0.01)mv++; mx=Math.max(mx,d);} console.log('   moved verts',mv,'max shift',fmt(mx));
}
