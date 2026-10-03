import sys, re, json, os, numpy as np, kn5
from scipy import ndimage
# Put each car's main .kn5 in models/ and name it here. Run from the repo root: python3 tools/export.py nb gr is
CARS={'nb':'models/mazda_roadster.kn5','gr':'models/toyota_gr86_premium.kn5','is':'models/lexus_is_300_jdm.kn5'}
EXCL=re.compile(r'^(WHEEL_|SUSP_|DISC_|HUB_)',re.I)
INTERIOR=re.compile(r'^int|interior|seat|steer|gauge|cup_holder|^can$|cigpack|gear_knob|cage|carpet|leather|stitch|speaker|belt|decal|headliner|pedal|button|hud|dash|radio|airbag|warning|symboled|emblem',re.I)
def group(mat):
    m=mat.lower()
    if re.search(r'light|lamp|bulb|reflector|refl_|_refl|led|lens|blinker|bezel|angle_eye|amber|hidhead|red_glass|detail_glass|fog',m): return 'light'
    if re.search(r'glass|windshield|window|tint|windscreen',m): return 'glass'
    if re.search(r'^body$|ext_body|body_gt86|carpaint|race_kit',m): return 'paint'
    if re.search(r'chrome|^alu$|exhaust|exh_|mirror',m): return 'metal'
    return 'trim'
def run(car,VOX=0.025):
    k=kn5.load(CARS[car]); nodes=k['nodes']; mats=k['mats']
    kids={}
    for n in nodes: kids.setdefault(n['parent'],[]).append(n['id'])
    dead=set()
    def kill(i):
        dead.add(i)
        for c in kids.get(i,[]): kill(c)
    wheels={}
    for n in nodes:
        if n['cls']==1 and (EXCL.match(n['name']) or not n['active']): kill(n['id'])
        if n['cls']==1 and re.match(r'^WHEEL_(LF|RF|LR|RR)$',n['name']): wheels[n['name'][-2:]]=n
    # model tyre radius per wheel
    wm={}
    for key,wn in wheels.items():
        W=wn['world']; t=W[3,:3]; Rm=W[:3,:3]; rt=0
        st=[wn['id']]
        while st:
            j=st.pop(); st+=kids.get(j,[]); n=nodes[j]
            if n['cls']==2 and mats[n['mat']]['shader']=='ksTyres':
                wv=n['v'][:,:3].astype(float)@n['world'][:3,:3]+n['world'][3,:3]; loc=(wv-t)@Rm.T
                rt=max(rt,np.hypot(loc[:,1],loc[:,2]).max())
        ax=np.array([1,0,0])@Rm
        wm[key]={'t':t.tolist(),'rTyre':float(rt),'camber':float(-abs(np.degrees(np.arcsin(ax[1]))))}
    P=[];N=[];I=[];G=[];MN=[];off=0
    for n in nodes:
        if n['cls']!=2 or n['id'] in dead or not n['active'] or not n['visible'] or not n['renderable']: continue
        M=n['world']; v=n['v']
        p=v[:,:3].astype(np.float64)@M[:3,:3]+M[3,:3]
        nr=v[:,3:6].astype(np.float64)@M[:3,:3]; nr/=np.maximum(np.linalg.norm(nr,axis=1,keepdims=True),1e-9)
        idx=n['idx'].astype(np.int64).reshape(-1,3)
        P.append(p);N.append(nr);I.append(idx+off);off+=len(p)
        G+= [group(mats[n['mat']]['name'])]*len(idx); MN+=[mats[n['mat']]['name']]*len(idx)
    P=np.vstack(P);N=np.vstack(N);I=np.vstack(I);G=np.array(G);MN=np.array(MN)
    print(car,'candidate tris',len(I),'verts',len(P))
    # ---- line-of-sight exterior test: orthographic point-splat z-buffers from many outside views
    a,b,c=P[I[:,0]],P[I[:,1]],P[I[:,2]]
    area=0.5*np.linalg.norm(np.cross(b-a,c-a),axis=1)
    SP=0.01; PIX=0.02; TOL=0.03
    ns=np.clip(np.ceil(area/SP**2).astype(int),1,20000)
    tid=np.repeat(np.arange(len(I)),ns)
    rng=np.random.default_rng(1); u=rng.random(len(tid)); w=rng.random(len(tid)); f=u+w>1; u[f]=1-u[f]; w[f]=1-w[f]
    S=a[tid]+(b[tid]-a[tid])*u[:,None]+(c[tid]-a[tid])*w[:,None]
    S=np.vstack([S,a,b,c,(a+b+c)/3]).astype(np.float32); tid=np.concatenate([tid,np.arange(len(I)),np.arange(len(I)),np.arange(len(I)),np.arange(len(I))])
    print('  samples',len(S))
    views=[]
    for el in (-12,8,28,50,72):
        for az in range(0,360,20): views.append((az,el))
    views.append((0,90))
    vis=np.zeros(len(S),bool)
    for az,el in views:
        az_,el_=np.radians(az),np.radians(el)
        d=np.array([np.cos(el_)*np.sin(az_),np.sin(el_),np.cos(el_)*np.cos(az_)],np.float32)   # direction towards the viewer
        r=np.cross([0,1,0],d) if abs(el)<89 else np.array([1,0,0]); r=(r/np.linalg.norm(r)).astype(np.float32); up=np.cross(d,r).astype(np.float32)
        x=S@r; y=S@up; z=-(S@d)                      # smaller z = nearer the viewer
        ix=((x-x.min())/PIX).astype(np.int32); iy=((y-y.min())/PIX).astype(np.int32); W=ix.max()+1
        pid=iy*W+ix; zb=np.full(pid.max()+1,np.inf,np.float32); np.minimum.at(zb,pid,z)
        vis|= z<=zb[pid]+TOL
    keep=np.zeros(len(I),bool); np.logical_or.at(keep,tid,vis)
    keep&=~np.array([bool(INTERIOR.search(m)) and not re.search('windshield|glass|tint',m,re.I) for m in MN])
    for kx,v in wm.items():
        t=np.array(v['t']); c=(a+b+c_)/3 if False else None
        for arr in (0,):
            pa,pb,pc=P[I[:,0]],P[I[:,1]],P[I[:,2]]
            def inside(p): return (np.hypot(p[:,1]-t[1],p[:,2]-t[2])<0.62*v['rTyre'])&(np.abs(p[:,0]-t[0])<0.26)
            keep&=~(inside(pa)&inside(pb)&inside(pc))
    print('  exterior tris',keep.sum())
    import collections
    cnt=collections.Counter(); tot=collections.Counter()
    for m,kp in zip(MN,keep): tot[m]+=1; cnt[m]+=kp
    for m,v in sorted(tot.items(),key=lambda x:-cnt[x[0]]): 
        if cnt[m]>0: print('    %-34s %-6s kept %6d / %6d'%(m[:34],group(m),cnt[m],v))
    # ---- frame: ground and centre
    yg=np.mean([wm[k]['t'][1]-wm[k]['rTyre'] for k in wm]); zF=wm['LF']['t'][2]; zR=wm['LR']['t'][2]; zc=(zF+zR)/2
    shift=np.array([0,-yg,-zc]); P=P+shift
    os.makedirs('tmp',exist_ok=True); meta={'car':car,'groups':{},'wheelsModel':{}}
    for kx,v in wm.items():
        t=np.array(v['t'])+shift; meta['wheelsModel'][kx]={'x':round(float(t[0]),4),'y':round(float(t[1]),4),'z':round(float(t[2]),4),'rTyre':round(v['rTyre'],4),'camber':round(v['camber'],2)}
    for g in ['paint','glass','light','metal','trim']:
        sel=keep&(G==g)
        if not sel.any(): continue
        tri=I[sel]; used,inv=np.unique(tri,return_inverse=True)
        P[used].astype('<f4').tofile('tmp/%s_%s.pos'%(car,g)); N[used].astype('<f4').tofile('tmp/%s_%s.nrm'%(car,g)); inv.reshape(-1).astype('<u4').tofile('tmp/%s_%s.idx'%(car,g))
        meta['groups'][g]={'nv':int(len(used)),'nt':int(len(tri))}
    meta['bbox']=[P[np.unique(I[keep])].min(0).round(4).tolist(),P[np.unique(I[keep])].max(0).round(4).tolist()]
    json.dump(meta,open('tmp/%s_meta.json'%car,'w'),indent=1); print(json.dumps(meta))
for car in sys.argv[1:]: run(car)
