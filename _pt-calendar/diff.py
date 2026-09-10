import json, os
BASE=os.path.dirname(os.path.abspath(__file__))
prod=json.load(open(os.path.join(BASE,'..','data','produce.json')))
src=json.load(open(os.path.join(BASE,'pt-sources.json')))['items']

# our id -> source key
MAP={
 'apricot':'damasco/alperce','cherry':'cereja','fig':'figo','kiwi':'kiwi','orange':'laranja',
 'lemon':'limao','apple':'maca','cooking-apple':'maca','watermelon':'melancia','honeydew-melon':'melao',
 'cantaloupe-melon':'meloa','strawberry':'morango','pear':'pera','conference-pear':'pera','peach':'pessego',
 'nectarine':'pessego','pomegranate':'roma','mandarin-clementine':'tangerina','grapes':'uva','grapes-black':'uva',
 'blueberry':'mirtilo','raspberry':'framboesa','blackberry':'amora','plum':'ameixa','damson':'ameixa',
 'greengage':'ameixa','persimmon-kaki':'diospiro','medlar':'nespera','quince':'marmelo','avocado':'abacate',
 'pumpkin':'abobora','butternut-squash':'abobora','acorn-squash':'abobora','crown-prince-squash':'abobora',
 'spaghetti-squash':'abobora','kabocha':'abobora','lettuce':'alface','romaine-cos':'alface','little-gem':'alface',
 'garlic':'alho','leek':'alho-frances','potato':'batata','new-potato':'batata-nova','aubergine':'beringela',
 'beetroot':'beterraba','golden-beetroot':'beterraba','broccoli-calabrese':'brocolo',
 'tenderstem-broccoli':'brocolo','purple-sprouting-broccoli':'brocolo','onion':'cebola','red-onion':'cebola',
 'carrot':'cenoura','heritage-carrots':'cenoura','courgette':'curgete','marrow':'curgete','cauliflower':'couve-flor',
 'romanesco':'couve-flor','garden-peas':'ervilha','mangetout':'ervilha','sugar-snap-peas':'ervilha',
 'spinach':'espinafre','green-french-beans':'feijao-verde','runner-beans':'feijao-verde','bell-pepper':'pimento',
 'chilli-pepper':'pimento','padr-n-pepper':'pimento','tomato':'tomate','cherry-tomato':'tomate',
 'beefsteak-tomato':'tomate','plum-san-marzano-tomato':'tomate','green-cabbage':'couve','savoy-cabbage':'couve',
 'red-cabbage':'couve','kale':'couve','cavolo-nero':'couve','spring-greens':'couve','pointed-hispi-cabbage':'couve',
 'turnip':'nabo','chard':'acelga','watercress':'agriao','globe-artichoke':'alcachofra','asparagus':'espargos',
 'broad-beans-fava':'favas','cucumber':'pepino','radish':'rabanete','breakfast-radish':'rabanete','sweetcorn':'milho',
}
def months(fr,to):
    a=int(fr[:2]); b=int(to[:2])
    out=[]; m=a
    while True:
        out.append(m)
        if m==b: break
        m = m%12+1
        if len(out)>13: break
    return set(out)
def srcmonths(pair):
    if not pair: return None
    a,b=pair; out=[]; m=a
    while True:
        out.append(m)
        if m==b: break
        m=m%12+1
        if len(out)>13: break
    return set(out)
MN='- Jan Feb Mar Abr Mai Jun Jul Ago Set Out Nov Dez'.split()
def bar(s):
    return ''.join('#' if i in s else '.' for i in range(1,13)) if s else ' '*12

rows=[]
for x in prod:
    k=MAP.get(x['id'])
    if not k or k not in src: continue
    mr=(x.get('season_ranges') or {}).get('mediterranean')
    ours=set()
    for r in (mr or []): ours |= months(r['from'],r['to'])
    s=src[k]
    ref = srcmonths(s.get('APN')) or srcmonths(s.get('DECO')) or srcmonths(s.get('CNT'))
    which = 'APN' if s.get('APN') else ('DECO' if s.get('DECO') else 'CNT')
    if not ref: continue
    if not mr:
        verdict='NO RANGE (prose only)'
    else:
        miss=ref-ours; extra=ours-ref
        if not miss and not extra: verdict='ok'
        else:
            parts=[]
            if extra: parts.append('we claim +'+','.join(MN[m] for m in sorted(extra)))
            if miss: parts.append('we miss '+','.join(MN[m] for m in sorted(miss)))
            verdict='; '.join(parts)
    rows.append((x['id'], x['name_local'].get('pt',''), bar(ours), bar(ref), which, verdict))

rows.sort(key=lambda r:(r[5]=='ok', r[5].startswith('NO RANGE'), r[0]))
print(f"{'id':<26}{'PT':<24}{'ours JFMAMJJASOND':<18}{'source':<14}{'src':<6}verdict")
print('-'*140)
for r in rows: print(f"{r[0]:<26}{r[1]:<24}{r[2]:<18}{r[3]:<14}{r[4]:<6}{r[5]}")
print()
print('total compared:',len(rows))
print('ok:',sum(1 for r in rows if r[5]=='ok'))
print('no range:',sum(1 for r in rows if r[5].startswith('NO RANGE')))
print('DISAGREE:',sum(1 for r in rows if r[5] not in ('ok',) and not r[5].startswith('NO RANGE')))
