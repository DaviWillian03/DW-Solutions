def L(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    la,lb=sorted([L(a),L(b)],reverse=True); return (la+0.05)/(lb+0.05)
P={
'A':[('text','#16202E','#F6F8FB'),('text-2','#475467','#FFFFFF'),('muted','#667085','#FFFFFF'),('muted/bg','#667085','#F6F8FB'),('primary link','#1D5FD1','#FFFFFF'),('branco/primary','#FFFFFF','#1D5FD1'),('ok pill','#136F35','#E7F6EC'),('warn pill','#A15C07','#FDF3E1'),('crit pill','#C0262D','#FDECEC'),('unk pill','#5B6472','#EEF0F3'),('info pill','#1D5FD1','#E8F0FD'),('banner','#7A4B00','#FFF7E0')],
'B':[('text','#EAEEF8','#121A2E'),('text-2','#B4BCD3','#121A2E'),('muted','#8C95B0','#121A2E'),('muted/bg','#8C95B0','#0B1020'),('primary link','#8B7CFF','#121A2E'),('ok','#4ADE80','#121A2E'),('warn','#FBBF24','#121A2E'),('crit','#F87171','#121A2E'),('unk','#A1A9BF','#121A2E'),('info','#93A8FF','#121A2E'),('banner','#FCD679','#0B1020')],
'C':[('text','#1E2421','#F5F3EE'),('text-2','#4A524E','#FFFFFF'),('muted','#69716C','#FFFFFF'),('muted/bg','#69716C','#F5F3EE'),('primary link','#0E6E64','#FFFFFF'),('sidebar texto','#D7E5E2','#14332F'),('sidebar grupo','#8FB0AA','#14332F'),('ok pill','#177245','#E3F3E9'),('warn pill','#9A5A00','#FCEFD9'),('crit pill','#B42318','#FCE9E7'),('unk pill','#5E6661','#ECEDEA'),('info pill','#2457A6','#E6EEFA'),('badge âmbar','#1E2421','#E39B2D'),('banner','#6B4400','#FFF4D6')],
}
for k,v in P.items():
    print(f'Direção {k}')
    for n,f,b in v:
        r=cr(f,b); print(f'  {n:16s} {f} sobre {b}: {r:5.2f}  {"OK AA" if r>=4.5 else ("AA grande" if r>=3 else "FALHA")}')
