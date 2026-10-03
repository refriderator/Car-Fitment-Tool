import struct, sys, os
def c_int(x):
    x&=0xFFFFFFFF
    return x-(1<<32) if x&0x80000000 else x
def cdiv(a,b):
    q=abs(a)//abs(b)
    return q if (a>=0)==(b>=0) else -q
def cmod(a,b): return a-cdiv(a,b)*b
def key(folder):
    s=[ord(c) for c in folder.lower()]; n=len(s)
    f1=0
    for c in s: f1=c_int(f1+c)
    f2=0
    for i in range(0,n-1,2): f2=c_int(c_int(f2*s[i])-s[i+1])
    f3=0
    for i in range(1,n-3,3):
        f3=c_int(f3*s[i]); f3=cdiv(f3,s[i+1]+27); f3=c_int(f3+(-27-s[i-1]))
    f4=5763
    for i in range(1,n): f4=c_int(f4-s[i])
    f5=66
    for i in range(1,n-4,4): f5=c_int(c_int((s[i]+15)*f5)*(s[i-1]+15)+22)
    f6=101
    for i in range(0,n-2,2): f6=c_int(f6-s[i])
    f7=171
    for i in range(0,n-2,2): f7=cmod(f7,s[i])
    f8=171
    for i in range(0,n-1): f8=c_int(cdiv(f8,s[i])+s[i+1])
    return '-'.join(str(x&0xFF) for x in (f1,f2,f3,f4,f5,f6,f7,f8))
def unpack(path,folder,out):
    b=open(path,'rb').read(); p=0
    if struct.unpack_from('<i',b,0)[0]==-1111: p=8
    k=key(folder).encode(); os.makedirs(out,exist_ok=True); names=[]
    while p<len(b):
        n=struct.unpack_from('<i',b,p)[0]; p+=4; name=b[p:p+n].decode(); p+=n
        size=struct.unpack_from('<i',b,p)[0]; p+=4
        data=bytes(( (b[p+4*i]-k[i%len(k)])&0xFF for i in range(size))); p+=4*size
        open(os.path.join(out,name),'wb').write(data); names.append(name)
    return names
if __name__=='__main__':
    # python3 tools/acd.py <car folder>   (the folder name is the key, so keep it as downloaded)
    folder=sys.argv[1].rstrip('/'); name=os.path.basename(folder)
    print(name, len(unpack(os.path.join(folder,'data.acd'), name, os.path.join('tmp','data_'+name))), 'files')
