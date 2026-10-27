import math
def lin(v):
    v/=255; return v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]
def L(h): r,g,b=map(lin,rgb(h)); return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b): x,y=L(a),L(b); return (max(x,y)+.05)/(min(x,y)+.05)
def lab(h):
    r,g,b=map(lin,rgb(h)); X=(0.4124*r+0.3576*g+0.1805*b)/0.95047; Y=0.2126*r+0.7152*g+0.0722*b; Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return 116*f(Y)-16, 500*(f(X)-f(Y)), 200*(f(Y)-f(Z))
def de2000(a,b):
    L1,a1,b1=lab(a);L2,a2,b2=lab(b)
    C1=math.hypot(a1,b1);C2=math.hypot(a2,b2);Cb=(C1+C2)/2;G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7)))
    a1p,a2p=a1*(1+G),a2*(1+G);C1p,C2p=math.hypot(a1p,b1),math.hypot(a2p,b2)
    h=lambda x,y: math.degrees(math.atan2(y,x))%360
    h1p,h2p=h(a1p,b1),h(a2p,b2);dL=L2-L1;dC=C2p-C1p
    dh=h2p-h1p
    if C1p*C2p==0: dh=0
    elif dh>180: dh-=360
    elif dh<-180: dh+=360
    dH=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh/2))
    Lb=(L1+L2)/2;Cbp=(C1p+C2p)/2
    hb=(h1p+h2p)/2 if abs(h1p-h2p)<=180 else (h1p+h2p+360)/2
    T=1-0.17*math.cos(math.radians(hb-30))+0.24*math.cos(math.radians(2*hb))+0.32*math.cos(math.radians(3*hb+6))-0.2*math.cos(math.radians(4*hb-63))
    Sl=1+0.015*(Lb-50)**2/math.sqrt(20+(Lb-50)**2);Sc=1+0.045*Cbp;Sh=1+0.015*Cbp*T
    Rt=-2*math.sqrt(Cbp**7/(Cbp**7+25**7))*math.sin(math.radians(60*math.exp(-((hb-275)/25)**2)))
    return math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh))
