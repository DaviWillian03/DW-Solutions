def L(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def cr(a,b):
    la,lb=sorted([L(a),L(b)],reverse=True); return (la+0.05)/(lb+0.05)
P={
'Claro':[('texto/fundo','#0A1730','#F6F8FC'),('texto-2/superfície','#3E4E69','#FFFFFF'),('apagado/superfície','#5C6B84','#FFFFFF'),('apagado/fundo','#5C6B84','#F6F8FC'),('link royal/branco','#1A4FD6','#FFFFFF'),('branco/royal (aba ativa)','#FFFFFF','#1A4FD6'),('herói subtítulo/marinho','#BFD2FA','#0A1F4D'),('herói subtítulo/marinho-2','#BFD2FA','#13306E'),('herói subtítulo/royal (canto)','#BFD2FA','#1A4FD6'),('destaque rótulo/royal','#C9DAFF','#1A4FD6'),('ok pílula','#0F7A43','#E4F5EB'),('atenção pílula','#94560A','#FDF2DE'),('crítico pílula','#BF2A2A','#FDEBEB'),('desconhecido pílula','#566176','#EDF0F4'),('info pílula','#1A4FD6','#E9F0FF'),('faixa simulado','#6E4600','#FFF6DC')],
'Escuro':[('texto/fundo','#EEF3FF','#060D1C'),('texto-2/superfície','#B9C6E2','#0C1730'),('apagado/superfície','#8E9CBC','#0C1730'),('link/superfície','#6E9BFF','#0C1730'),('aba ativa texto/royal','#06102A','#6E9BFF'),('ok/superfície','#4ADE80','#0C1730'),('atenção/superfície','#FBBF24','#0C1730'),('crítico/superfície','#F87171','#0C1730'),('desconhecido/superfície','#A6B1C9','#0C1730'),('info/superfície','#8FB2FF','#0C1730'),('faixa simulado','#FCD679','#060D1C')],
}
for k,v in P.items():
    print(f'Tema {k}')
    for n,f,b in v:
        r=cr(f,b); print(f'  {n:32s} {f} sobre {b}: {r:5.2f}  {"OK AA" if r>=4.5 else ("AA grande" if r>=3 else "FALHA")}')
