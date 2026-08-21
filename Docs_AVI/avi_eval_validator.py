# -*- coding: utf-8 -*-
"""VALIDADOR UNIFICADO AVI — aplica TODAS las restricciones a las 25 preguntas.
Transversales para todos los perfiles + específicas por perfil."""
import json, re, sys

TMP="/Users/alstrat/.claude/jobs/5a5c74b1/tmp"
SRC=sys.argv[1] if len(sys.argv)>1 else f"{TMP}/eval_results_v3.json"
R=json.load(open(SRC))

INGLES=["touch","proximity","time-in","time out","timeout","mindfulness","parenting","coping",
        "attachment","arousal","trigger","insight","feedback","check-in","self-care","bonding",
        "caregiver","holding","soothe","empowerment","playful","connection","safe haven","secure base",
        "big behaviors","meltdown","tantrum","time-out","co-regulation","window of tolerance"]
SIGLAS_OK={"tea","tdah","arc","tbri","emdr","pii","nna","fae","ccm","avi","ptsd"}
ABSOLUTOS=["completamente","perfectamente","totalmente","absolutamente","obviamente"]
NO_CHILE=["rotafolio","ordenador","móvil","platicar","zumo","chaval","vosotros","coger "]
TEL_PROHIBIDOS=["600 360 7777","línea de la vida","salud responde"]
APERTURAS=["claro","por supuesto","con gusto","perfecto","desde luego","entiendo perfectamente","comprendo perfectamente"]
CONDESCENDENCIA=["entiendo que","es comprensible","comprendo que","debe ser difícil","entiendo lo"]

def checks_for(x):
    a=x.get("answer") or ""; low=a.lower(); q=x["question"].lower(); prof=x["profile"]
    out=[]  # (codigo, descripcion, ok, detalle)

    # ---------- TRANSVERSALES ----------
    ing=[w for w in INGLES if re.search(r"\b"+re.escape(w)+r"\b", low)]
    par=re.findall(r"\(([A-Za-z][a-z]+(?:\s+(?:and|&|of|in)\s+[A-Za-z][a-z]+)+)\)", a)
    par=[p for p in par if p.lower() not in SIGLAS_OK]
    out.append(("T1","sin palabras en inglés", not ing and not par, (ing+par) or None))

    user_dijo=bool(re.search(r"rabiet|patalet", q))
    rab=re.findall(r"rabiet[ao]s?|patalet[ao]s?", low)
    out.append(("T2","sin «rabieta»/«pataleta»", user_dijo or not rab, rab or None))

    absol=[w for w in ABSOLUTOS if w in low]
    out.append(("T3","sin absolutos", not absol, absol or None))

    pidio_piiu = "pii-u" in q or "unificado" in q
    piiu=re.findall(r"pii-u|plan de intervención individual unificado", low)
    out.append(("T4","sin «PII-U» proactivo", pidio_piiu or not piiu, piiu or None))

    nc=[w for w in NO_CHILE if re.search(r"\b"+re.escape(w.strip())+r"\b", low)]
    out.append(("T5","léxico chileno", not nc, nc or None))

    gen_q=bool(re.search(r"niñ[ao]|nieto|nieta|sobrin[ao]|hij[ao]|adolescente de|calmarl[ao]|\bél\b|\bella\b", q))
    if gen_q: out.append(("T6","género coherente (indicado por el usuario)", True, None))
    else:
        solo_masc=bool(re.search(r"\bél\b|\blo dejes solo\b|\bel niño\b", low)) and not re.search(r"\bella\b|la niña|el nna|niño o (la )?niña|o segura|o tranquila", low)
        out.append(("T6","no asume género", not solo_masc, "usa masculino sin neutralizar" if solo_masc else None))

    first=a.split("\n")[0].lower()
    ap=[p for p in APERTURAS if first.startswith(p)]
    out.append(("T7","sin apertura prohibida", not ap, ap or None))

    tel=[t for t in TEL_PROHIBIDOS if t in low]
    if re.search(r"\b131\b", a): tel.append("131")
    out.append(("T8","sin teléfonos eliminados", not tel, tel or None))

    # ---------- POR PERFIL ----------
    if prof=="residencia":
        mal=[t for t in ["dupla","equipo fae","equipo avi"] if t in low]
        out.append(("R1","naming «tu equipo» (sin dupla/FAE)", not mal, mal or None))
        out.append(("R2","puede usar Fono Infancia 147", True, None))

    if prof=="equipo":
        pos=[t for t in ["tu dupla","tu equipo fae","tu coordinación","contacta a tu equipo"] if t in low]
        out.append(("E1","no deriva en posesivo a su propia dupla", not pos, pos or None))
        tel_eq=bool(re.search(r"\b147\b", a)) or "fono infancia" in low
        out.append(("E2","NO entrega números telefónicos", not tel_eq, "menciona 147/Fono Infancia" if tel_eq else None))
        necesita_escalar = x["qid"] in ("E3","E7")
        escala = ("jefatura" in low) or ("protocolo" in low)
        out.append(("E3","escala por jefatura / protocolos", escala if necesita_escalar else True,
                    None if (escala or not necesita_escalar) else "no menciona jefatura ni protocolo"))
        cond=[p for p in CONDESCENDENCIA if first.startswith(p) or first[:60].find(p)>=0]
        out.append(("E4","sin condescendencia en la apertura", not cond, cond or None))
        out.append(("E5","AVI no se cree parte del equipo", "como parte del equipo" not in low, None))

    if prof in ("extensa","externa"):
        mal=[t for t in ["equipo avi","jefatura"] if t in low]
        out.append(("F1","naming dupla/equipo FAE (sin Equipo AVI ni jefatura)", not mal, mal or None))
        nq=a.count("¿")
        out.append(("F2","máximo 2 preguntas", nq<=2, f"{nq} preguntas" if nq>2 else None))
        lista=bool(re.search(r"^\s*(?:[\*\-•]|\d+\.)\s*\*?\*?¿", a, re.M))
        out.append(("F3","preguntas no en lista/viñetas", not lista, "preguntas en lista" if lista else None))

    return out

print("="*100)
print("VALIDADOR UNIFICADO AVI — 25 preguntas · restricciones transversales + por perfil")
print("="*100)
gaps=[]; total=0; oks=0
por_perfil={}
for x in R:
    res=checks_for(x)
    fails=[(c,d,det) for c,d,ok,det in res if not ok]
    total+=len(res); oks+=len(res)-len(fails)
    por_perfil.setdefault(x["profile"],{"q":0,"f":0}); por_perfil[x["profile"]]["q"]+=1
    if fails:
        por_perfil[x["profile"]]["f"]+=len(fails)
        gaps.append((x["qid"],x["profile"],fails))
    estado="✓" if not fails else "✗ "+", ".join(c for c,_,_ in fails)
    print(f"  {x['qid']:4} {x['profile']:10} {len(res):2} checks  {estado}")

print("\n" + "-"*100)
print(f"RESULTADO: {oks}/{total} checks OK sobre {len(R)} preguntas")
for p,v in por_perfil.items():
    print(f"   {p:11} {v['q']} preguntas · {v['f']} checks fallidos")
if gaps:
    print("\nGAPS ENCONTRADOS:")
    for qid,prof,fails in gaps:
        for c,d,det in fails:
            print(f"   [{qid} · {prof}] {c} — {d}" + (f" → {det}" if det else ""))
else:
    print("\nSIN GAPS ✔")
