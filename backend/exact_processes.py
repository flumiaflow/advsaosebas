import requests

url = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
termos = [
    'MATERIAIS DE CONSTRUCAO SAO SEBASTIAO',
    'MATERIAIS DE CONSTRUCAO ALIANCE',
    'MATERIAIS DE CONSTRUCAO ALIANCE EIRELI'
]

exatos = {}
for t in termos:
    res = requests.get(url, params={'nomeParte': t, 'itensPorPagina': 100})
    for it in res.json().get('items', []):
        num = it.get('numero_processo')
        if not num:
            continue
        dests = [d.get('nome', '').upper() for d in it.get('destinatarios', [])]
        matched = False
        for d in dests:
            if 'MATERIAIS DE CONSTRU' in d and ('SAO SEBASTIAO' in d or 'ALIANCE' in d):
                matched = True
                break
        if matched:
            if num not in exatos:
                exatos[num] = {
                    'num': it.get('numeroprocessocommascara') or num,
                    'tribunal': it.get('siglaTribunal'),
                    'orgao': it.get('nomeOrgao'),
                    'classe': it.get('nomeClasse'),
                    'destinatarios': dests
                }

print(f"Total de processos EXATOS das empresas ({len(exatos)} no total):\n")
for k, v in exatos.items():
    print(f"-> Processo: {v['num']} | Tribunal: {v['tribunal']} | Classe: {v['classe']}")
    print(f"   Vara / Órgão: {v['orgao']}")
    print(f"   Destinatários: {v['destinatarios']}")
    print("-" * 75)
