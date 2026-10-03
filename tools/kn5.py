import struct, numpy as np, sys
class R:
    def __init__(s,b): s.b=b; s.p=0
    def i(s): v=struct.unpack_from('<i',s.b,s.p)[0]; s.p+=4; return v
    def f(s): v=struct.unpack_from('<f',s.b,s.p)[0]; s.p+=4; return v
    def u8(s): v=s.b[s.p]; s.p+=1; return v
    def st(s): n=s.i(); v=s.b[s.p:s.p+n].decode('utf-8','replace'); s.p+=n; return v
    def skip(s,n): s.p+=n
def load(path, want_mesh=True):
    b=open(path,'rb').read(); r=R(b)
    assert b[:6]==b'sc6969', b[:6]; r.p=6
    ver=r.i()
    if ver>5: r.i()
    nt=r.i(); tex=[]
    for _ in range(nt):
        r.i(); name=r.st(); n=r.i(); r.skip(n); tex.append(name)
    nm=r.i(); mats=[]
    for _ in range(nm):
        m={'name':r.st(),'shader':r.st()}
        m['blend']=r.u8(); m['alphaTested']=r.u8()
        m['depth']=r.i()
        props={}
        for _ in range(r.i()):
            pn=r.st(); pv=r.f(); r.skip(36); props[pn]=pv
        m['props']=props
        tx={}
        for _ in range(r.i()):
            tn=r.st(); slot=r.i(); tv=r.st(); tx[tn]=tv
        m['tex']=tx; mats.append(m)
    nodes=[]
    def node(parent, pm, depth):
        cls=r.i(); name=r.st(); nch=r.i(); active=r.u8()
        n={'cls':cls,'name':name,'parent':parent,'active':active,'depth':depth,'id':len(nodes)}
        nodes.append(n)
        wm=pm
        if cls==1:
            M=np.array(struct.unpack_from('<16f',b,r.p),dtype=np.float64).reshape(4,4); r.p+=64
            n['local']=M; wm=M@pm
        elif cls==2:
            n['cast']=r.u8(); n['visible']=r.u8(); n['transp']=r.u8()
            vc=r.i()
            v=np.frombuffer(b,dtype='<f4',count=vc*11,offset=r.p).reshape(vc,11); r.p+=vc*44
            ic=r.i(); idx=np.frombuffer(b,dtype='<u2',count=ic,offset=r.p); r.p+=ic*2
            n['mat']=r.i(); n['layer']=r.i(); n['lodIn']=r.f(); n['lodOut']=r.f(); r.skip(16); n['renderable']=r.u8()
            n['vc']=vc; n['ic']=ic
            if want_mesh: n['v']=v; n['idx']=idx
        elif cls==3:
            n['cast']=r.u8(); n['visible']=r.u8(); n['transp']=r.u8()
            for _ in range(r.i()): r.st(); r.skip(64)
            vc=r.i(); v=np.frombuffer(b,dtype='<f4',count=vc*19,offset=r.p).reshape(vc,19); r.p+=vc*76
            ic=r.i(); idx=np.frombuffer(b,dtype='<u2',count=ic,offset=r.p); r.p+=ic*2
            n['mat']=r.i(); n['layer']=r.i(); r.skip(8)
            n['vc']=vc; n['ic']=ic; n['renderable']=1; n['skinned']=True
            if want_mesh: n['v']=v[:,:11]; n['idx']=idx
        else: raise Exception('cls %d at %d'%(cls,r.p))
        n['world']=wm
        for _ in range(nch): node(n['id'],wm,depth+1)
    node(-1,np.eye(4),0)
    return {'ver':ver,'tex':tex,'mats':mats,'nodes':nodes,'end':r.p,'size':len(b)}
if __name__=='__main__':
    k=load(sys.argv[1],False)
    print('ver',k['ver'],'tex',len(k['tex']),'mats',len(k['mats']),'nodes',len(k['nodes']),k['end'],k['size'])
    maxd=int(sys.argv[2]) if len(sys.argv)>2 else 3
    tot=0
    for n in k['nodes']:
        if n['cls']!=1: tot+=n['ic']//3
        if n['depth']<=maxd:
            if n['cls']==1:
                t=n['world'][3,:3]
                print('  '*n['depth']+'[%s] t=(%.3f,%.3f,%.3f)'%(n['name'],*t))
            else:
                print('  '*n['depth']+'%s tris=%d mat=%s'%(n['name'],n['ic']//3,k['mats'][n['mat']]['name']))
    print('total tris',tot)
