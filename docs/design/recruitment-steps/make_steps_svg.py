"""Generate the Recruitment Steps diagram (TA or ULA variant) from a table of steps and edges."""
import sys
FS=13; LH=16; CHAR=5.9; H=62; MARGIN=20; GAP=40; WIDE_GAP=95
PAD_L=8; NUM_W=17; PAD_R=5

def build(kind):
    labels={1:[f"Create {kind}","Recruitment"],2:[f"Open {kind}","Applications"],3:["Budget /","Allocations"],
     4:[f"Close {kind}","Applications"],5:["Release","Allocations","to Faculty *"],6:["Open","Faculty","Ranking"],
     7:["Close","Faculty","Ranking"],8:["Assign","Candidates","to Slots"],9:["Release","Hiring","Decisions"]}
    w={n: round(PAD_L+NUM_W+max(len(l) for l in ls)*CHAR+PAD_R) for n,ls in labels.items()}
    cols=[(1,),(2,3),(4,5),(6,),(8,),(9,)]
    colw=[max(w[n] for n in c) for c in cols]
    gaps=[GAP,GAP,GAP,WIDE_GAP,GAP]
    x=MARGIN; colx=[]
    for i,cw in enumerate(colw):
        colx.append(x); x+=cw+(gaps[i] if i<len(gaps) else 0)
    TOTAL=round(x+MARGIN)
    TOP=45; BOT=175; MID=110
    g={}
    def place(n,col,top):
        bx=colx[col]+(colw[col]-w[n])/2
        g[n]=dict(x=bx,y=top,w=w[n],h=H,cx=bx+w[n]/2,cy=top+H/2)
    place(1,0,MID); place(2,1,TOP); place(3,1,BOT); place(4,2,TOP); place(5,2,BOT); place(6,3,BOT); place(8,4,BOT); place(9,5,BOT)
    mid68=(colx[3]+colw[3]+colx[4])/2
    g[7]=dict(x=mid68-w[7]/2,y=TOP,w=w[7],h=H,cx=mid68,cy=TOP+H/2)
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{TOTAL}" height="392" viewBox="0 0 {TOTAL} 392" font-family="\'Arial Narrow\', \'Liberation Sans Narrow\', Arial, Helvetica, sans-serif" font-size="{FS}">',
    f'  <title>Steps in a {kind} recruitment and their prerequisites</title>',
    '  <desc>Nine steps as rounded boxes, left to right. Solid arrows are hard prerequisites; dashed arrows are soft prerequisites (the preferred order).</desc>',
    '''  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/>
    </marker>
    <style>
      .box { fill: #f8fafc; stroke: #334155; stroke-width: 1.5; }
      .num { font-weight: 700; fill: #0f172a; }
      .label { fill: #1e293b; }
      .hard { stroke: #334155; stroke-width: 1.6; fill: none; marker-end: url(#arrow); }
      .soft { stroke: #334155; stroke-width: 1.6; fill: none; stroke-dasharray: 5 4; marker-end: url(#arrow); }
      .legend { fill: #475569; font-size: 12px; }
    </style>
  </defs>''']
    for n in sorted(g):
        b=g[n]; ls=labels[n]
        out.append(f'  <rect class="box" x="{b["x"]:.1f}" y="{b["y"]}" width="{b["w"]}" height="{b["h"]}" rx="9"/>')
        k=len(ls); first=b['cy']-LH*(k-1)/2+FS*0.35
        t=f'  <text x="{b["x"]+PAD_L:.1f}" y="{first:.1f}"><tspan class="num">{n}.</tspan>'
        for i,l in enumerate(ls):
            t+=f'<tspan class="label" x="{b["x"]+PAD_L+NUM_W:.1f}"{"" if i==0 else f" dy=\"{LH}\""}>{l}</tspan>'
        out.append(t+'</text>')
    R=lambda n: g[n]['x']+g[n]['w']; L=lambda n: g[n]['x']; T=lambda n: g[n]['y']; Bt=lambda n: g[n]['y']+g[n]['h']
    hard=[]; soft=[]
    # 1 -> 2 and 1 -> 3: an S-curve with horizontal tangents at both ends, so the line enters the arrowhead from behind.
    for target,dy in ((2,-10),(3,10)):
        x0=R(1); y0=g[1]['cy']+dy; x1=L(target)-1; y1=g[target]['cy']; xe=x1-16; mx=(x0+xe)/2
        hard.append(f'M {x0:.1f} {y0:.1f} C {mx:.1f} {y0:.1f}, {mx:.1f} {y1:.1f}, {xe:.1f} {y1:.1f} H {x1:.1f}')
    for a,b,kind_ in [(2,4,'h'),(3,5,'h'),(5,6,'s'),(6,8,'h'),(8,9,'h')]:
        (hard if kind_=='h' else soft).append(f'M {R(a):.1f} {g[a]["cy"]:.1f} H {L(b)-1:.1f}')
    # 6 (bottom) -> 7 (top): horizontal tangent out of 6, vertical tangent into 7's bottom.
    x0=R(6); y0=g[6]['cy']-16; x1=g[7]['cx']; y1=Bt(7)+1; ye=y1+16
    hard.append(f'M {x0:.1f} {y0:.1f} C {x1:.1f} {y0:.1f}, {x1:.1f} {(y0+ye)/2:.1f}, {x1:.1f} {ye:.1f} V {y1:.1f}')
    soft.append(f'M {R(7):.1f} {g[7]["cy"]:.1f} H {g[8]["cx"]:.1f} V {T(8)-1}')
    soft.append(f'M {R(4):.1f} {g[4]["cy"]:.1f} H {g[6]["cx"]:.1f} V {T(6)-1}')
    hard.append(f'M {g[4]["cx"]:.1f} {T(4):.1f} V 22 H {g[9]["cx"]:.1f} V {T(9)-1}')
    # 7 -> 9: out of 7's right edge a little above the 7 -> 8 line, then down into 9's top, left of
    # where 4 -> 9 arrives so the two do not cross.
    hard.append(f'M {R(7):.1f} {g[7]["cy"]-12:.1f} H {g[9]["cx"]-20:.1f} V {T(9)-1}')
    for d in hard: out.append(f'  <path class="hard" d="{d}"/>')
    for d in soft: out.append(f'  <path class="soft" d="{d}"/>')
    out.append('  <line x1="30" y1="290" x2="75" y2="290" class="hard"/><text x="85" y="294" class="legend">hard prerequisite: must happen first</text>')
    out.append('  <line x1="30" y1="316" x2="75" y2="316" class="soft"/><text x="85" y="320" class="legend">soft prerequisite: the preferred order, not enforced</text>')
    out.append('  <text x="30" y="352" class="legend"><tspan font-weight="700">*</tspan> Allocation visibility has three settings: admins only (the default), each faculty member sees the allocations for the courses they teach,</text>')
    out.append('  <text x="30" y="370" class="legend">or all faculty see all allocations. Step 5 means moving off &quot;admins only&quot;.</text>')
    out.append('</svg>')
    return '\n'.join(out)+'\n', TOTAL

if __name__=='__main__':
    outdir=sys.argv[1]
    for kind in ('TA','ULA'):
        svg,total=build(kind)
        open(f'{outdir}/recruitment-steps-{kind.lower()}.svg','w').write(svg)
        print(kind, 'width', total)
