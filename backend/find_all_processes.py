import requests

url = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
termos = [
    'MATERIAIS DE CONSTRUCAO SAO SEBASTIAO',
    'MATERIAIS DE CONSTRUCAO ALIANCE',
    'SAO SEBASTIAO LTDA',
    'ALIANCE LTDA',
    'ALIANCE EIRELI'
]

encontrados = {}

for t in termos:
    res = requests.get(url, params={'nomeParte': t, 'itensPorPagina': 100})
    for it in res.json().get('items', []):
        num = it.get('numero_processo')
        if not num:
            continue
        dests = [d.get('nome', '').upper() for d in it.get('destinatarios', [])]
        if any(t in d for d in dests):
            if num not in encontrados:
                encontrados[num] = {
                    'num': num,
                    'numFormatado': it.get('numeroprocessocommascara') or num,
                    'tribunal': it.get('siglaTribunal'),
                    'orgao': it.get('nomeOrgao'),
                    'classe': it.get('nomeClasse'),
                    'destinatarios': dests,
                    'data': it.get('data_disponibilizacao'),
                    'tipo': it.get('tipoComunicacao')
                }

print(f"Total de processos reais encontrados no DJEN/CNJ: {len(encontrados)}\n")
for k, v in encontrados.items():
    print(f"Processo: {v['numFormatado']} | Tribunal: {v['tribunal']} | Classe: {v['classe']}")
    print(f"  Órgão: {v['orgao']}")
    print(f"  Destinatários: {v['destinatarios']}")
    print(f"  Última Publicação: {v['data']} - {v['tipo']}")
    print("-" * 75)
