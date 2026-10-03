import sys, re, numpy as np, kn5
CARS={'nb':'models/mazda_roadster.kn5','gr':'models/toyota_gr86_premium.kn5','is':'models/lexus_is_300_jdm.kn5'}
def subtree(nodes,i):
    ids=[i]; out=[]
    kids={}
    for n in nodes: kids.setdefault(n['parent'],[]).append(n['id'])
    st=[i]
    while st:
        j=st.pop(); out.append(j); st+=kids.get(j,[])
    return out
for car,path in CARS.items():
    k=kn5.load(path); nodes=k['nodes']; byname={}
    for n in nodes: byname.setdefault(n['name'],n)
    print('=====',car)
    for w in ['WHEEL_LF','WHEEL_RF','WHEEL_LR','WHEEL_RR']:
        wn=byname[w]; W=wn['world']; t=W[3,:3]; Rm=W[:3,:3]
        # camber from rotation: where does local up (0,1,0) go
        up=np.array([0,1,0])@Rm; ax=np.array([1,0,0])@Rm
        s='%s t=(%.4f %.4f %.4f) axle=(%.3f %.3f %.3f) camber=%.2f toe=%.2f'%(w,*t,*ax,np.degrees(np.arcsin(ax[1])),np.degrees(np.arctan2(ax[2],ax[0])))
        print(s)
        for j in subtree(nodes,wn['id']):
            n=nodes[j]
            if n['cls']==1 or not n['active']: continue
            m=k['mats'][n['mat']]
            wv=n['v'][:,:3].astype(float)@n['world'][:3,:3]+n['world'][3,:3]
            loc=(wv-t)@Rm.T   # to wheel-local (Rm orthonormal assumed)
            r=np.hypot(loc[:,1],loc[:,2]); lat=loc[:,0]
            if m['shader']=='ksTyres':
                rmin=r.min(); bead=lat[r<rmin+0.004]
                tread=lat[r>r.max()-0.004]
                print('   tyre  OD=%.1f  section lat[%.1f %.1f] w=%.1f  beadR=%.1f (D=%.2fin) bead lat[%.1f %.1f] w=%.1f  tread w=%.1f'%(2000*r.max(),1000*lat.min(),1000*lat.max(),1000*(lat.max()-lat.min()),1000*rmin,2*rmin/0.0254,1000*bead.min(),1000*bead.max(),1000*(bead.max()-bead.min()),1000*(tread.max()-tread.min())))
            elif m['shader']!='ksBrakeDisc' and not re.search('blur|logo|badge|LUG|Material.005|Material.006',m['name']+n['name'],re.I):
                print('   rim %-14s rmax=%.1f (flange D %.2fin)  lat[%.1f %.1f] w=%.1f (%.2fin)'%(m['name'][:14],1000*r.max(),2*r.max()/0.0254,1000*lat.min(),1000*lat.max(),1000*(lat.max()-lat.min()),(lat.max()-lat.min())/0.0254))
            elif m['shader']=='ksBrakeDisc':
                print('   disc rmax=%.1f lat[%.1f %.1f]'%(1000*r.max(),1000*lat.min(),1000*lat.max()))
