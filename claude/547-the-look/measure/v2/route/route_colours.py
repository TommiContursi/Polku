import math
def lab(h):
    r,g,b=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    f=lambda v: v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4
    R,G,B=f(r),f(g),f(b)
    X=(R*.4124+G*.3576+B*.1805)/.95047; Y=R*.2126+G*.7152+B*.0722; Z=(R*.0193+G*.1192+B*.9505)/1.08883
    h_=lambda t: t**(1/3) if t>216/24389 else (24389/27*t+16)/116
    X,Y,Z=h_(X),h_(Y),h_(Z); return (116*Y-16,500*(X-Y),200*(Y-Z))
def de(c1,c2):
    L1,a1,b1=c1;L2,a2,b2=c2;d=math.pi/180
    C7=lambda c:c**7/(c**7+25**7);G=.5*(1-math.sqrt(C7((math.hypot(a1,b1)+math.hypot(a2,b2))/2)))
    A1,A2=a1*(1+G),a2*(1+G);C1,C2=math.hypot(A1,b1),math.hypot(A2,b2)
    H=lambda b,a:(math.degrees(math.atan2(b,a))+360)%360;h1,h2=H(b1,A1),H(b2,A2)
    dh=0 if C1*C2==0 else h2-h1
    if dh>180: dh-=360
    elif dh<-180: dh+=360
    hm=h1+h2
    if C1*C2!=0: hm=hm/2 if abs(h1-h2)<=180 else ((hm+360)/2 if hm<360 else (hm-360)/2)
    Lm,Cm=(L1+L2)/2,(C1+C2)/2;dH=2*math.sqrt(C1*C2)*math.sin(dh*d/2)
    T=1-.17*math.cos((hm-30)*d)+.24*math.cos(2*hm*d)+.32*math.cos((3*hm+6)*d)-.2*math.cos((4*hm-63)*d)
    SL=1+.015*(Lm-50)**2/math.sqrt(20+(Lm-50)**2);SC=1+.045*Cm;SH=1+.015*Cm*T
    RT=-math.sin(60*math.exp(-((hm-275)/25)**2)*d)*2*math.sqrt(C7(Cm))
    return math.sqrt(((L2-L1)/SL)**2+((C2-C1)/SC)**2+(dH/SH)**2+RT*((C2-C1)/SC)*(dH/SH))
assert abs(de((50,2.6772,-79.7751),(50,0,-82.7485))-2.0425)<1e-3
def mix(h,a,bg):
    c=[int(h[i:i+2],16) for i in (1,3,5)];g=[int(bg[i:i+2],16) for i in (1,3,5)]
    return '#'+''.join('%02x'%round(x*a+y*(1-a)) for x,y in zip(c,g))
trail={'S0':'#22a447','S1':'#c7c100','S2':'#f59e0b','S3':'#ef4444','S4':'#c026d3','S5':'#7e22ce','S6':'#4c1d95',
 'path':'#1f1f1f','track':'#6b4f2a','cycleway':'#5b7fa8','foot centre':'#b42318','no-bike ticks':'#dc2626','grade 15%':'#dc2626','grade 20%':'#6d28d9','imported track':'#7c3aed','water route':'#0369a1','LIPAS ski':'#f472b6'}
for route in ['#d6006e','#e11d48']:
    print(route, ' '.join(f"{k}:{de(lab(route),lab(mix(v,.95,'#dbeacd'))):.1f}" for k,v in trail.items()))

# Machado, Oliveira and Fernandes (2009), severity 1.0, in linear RGB
M = {'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
     'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
     'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]}
def sim(h, k):
    f = lambda v: v/12.92 if v <= 0.04045 else ((v+0.055)/1.055)**2.4
    g = lambda v: 12.92*v if v <= 0.0031308 else 1.055*v**(1/2.4)-0.055
    c = [f(int(h[i:i+2], 16)/255) for i in (1, 3, 5)]
    o = [min(1, max(0, sum(M[k][r][j]*c[j] for j in range(3)))) for r in range(3)]
    return '#' + ''.join('%02x' % round(g(v)*255) for v in o)
print('\nunder colour blindness (trail colour at 95 % over the wood):')
for route in ['#d6006e', '#e11d48']:
    for k in M:
        print(route, k, ' '.join(f"{n}:{de(lab(sim(route,k)),lab(sim(mix(trail[n],.95,'#dbeacd'),k))):.1f}" for n in ['S3','S4','S5','foot centre','no-bike ticks','imported track']))
