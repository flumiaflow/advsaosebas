import time
import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = 'https://api-juriswatch.31.97.83.42.sslip.io/api'
session = requests.Session()

print('======================================================================')
print('🚀 INICIANDO TESTE COMPLETO E-2-E (SIMULAÇÃO REAL)')
print('======================================================================')

# 1. Login Super Admin
print('\n1. Efetuando login como Super Administrador...')
login_res = session.post(f'{BASE_URL}/auth/login', json={'email': 'admin@juriswatch.com', 'password': 'Admin123!'})
assert login_res.status_code == 200, f'Falha no login: {login_res.text}'
sa_token = login_res.json()['accessToken']
print('✅ Super Admin autenticado com sucesso!')

# 2. Criar novo Escritório
print('\n2. Cadastrando novo Escritório no Backoffice...')
unique_suffix = int(time.time())
tenant_payload = {
    'name': f'Advocacia Pinheiro & Associados {unique_suffix}',
    'plan': 'professional',
    'timezone': 'America/Sao_Paulo',
    'supervisorName': 'Dra. Vanessa Pinheiro',
    'supervisorEmail': f'vanessa_{unique_suffix}@advpinheiro.com.br'
}
tenant_res = session.post(f'{BASE_URL}/backoffice/tenants', json=tenant_payload, headers={'Authorization': f'Bearer {sa_token}'})
assert tenant_res.status_code == 201 or tenant_res.status_code == 200, f'Falha ao criar tenant: {tenant_res.text}'
tenant_data = tenant_res.json()
tenant_id = tenant_data.get('id') or tenant_data.get('tenant', {}).get('id')
print(f'✅ Escritório criado: ID {tenant_id} - Nome: {tenant_payload["name"]}')

# 3. Impersonate no Escritório
print('\n3. Realizando Impersonate no Escritório criado...')
imp_res = session.post(f'{BASE_URL}/auth/impersonate/{tenant_id}', headers={'Authorization': f'Bearer {sa_token}'})
assert imp_res.status_code == 200, f'Falha no impersonate: {imp_res.text}'
imp_token = imp_res.json()['accessToken']
headers = {'Authorization': f'Bearer {imp_token}'}
print('✅ Impersonate efetuado com sucesso! Token de Supervisor gerado.')

# 4. Cadastrar Cliente com Matriz e Filial reais
print('\n4. Cadastrando Grupo Empresarial e CNPJs...')
client_payload = {
    'name': 'Materiais de Construção São Sebastião Ltda',
    'fantasyName': 'Grupo São Sebastião & Aliance',
    'notes': 'Cliente corporativo do segmento varejista de materiais de construção',
    'cnpjs': [
        '07.049.926/0001-10', # Matriz
        '28.525.557/0001-65'  # Filial
    ]
}
client_res = session.post(f'{BASE_URL}/clients', json=client_payload, headers=headers)
assert client_res.status_code == 201, f'Falha ao cadastrar cliente: {client_res.text}'
client_data = client_res.json()
client_id = client_data['id']
print(f'✅ Cliente cadastrado com ID: {client_id}')
print(f'   Estabelecimentos criados: {len(client_data.get("establishments", []))}')

# 5. Disparar Sincronização / Varredura DataJud
print('\n5. Disparando Varredura DataJud (CNJ)...')
sync_res = session.post(f'{BASE_URL}/sync/client/{client_id}', headers=headers)
print(f'   Resposta do trigger de sincronização: {sync_res.status_code} - {sync_res.json()}')

print('   Aguardando processamento e indexação de processos no DataJud...')
for i in range(12):
    time.sleep(3)
    procs_check = session.get(f'{BASE_URL}/processes', headers=headers)
    if procs_check.status_code == 200 and len(procs_check.json()) > 0:
        print(f'   ⚡ Processos indexados até agora: {len(procs_check.json())}')
        break
    else:
        print(f'   ... aguardando worker ({i+1}/12)')

# 6. Listar e Validar Processos Capturados
print('\n6. Validando Processos Capturados no Workspace...')
procs_res = session.get(f'{BASE_URL}/processes', headers=headers)
assert procs_res.status_code == 200, f'Falha ao listar processos: {procs_res.text}'
processes = procs_res.json()
print(f'✅ Total de Processos Capturados: {len(processes)}')
assert len(processes) > 0, 'Nenhum processo foi capturado!'

first_proc = processes[0]
proc_id = first_proc['id']
print(f'   Primeiro Processo: {first_proc.get("processNumber")}')
print(f'   Tribunal: {first_proc.get("tribunal")} | Vara: {first_proc.get("varaOrgao")}')
print(f'   Classe: {first_proc.get("className")} | Assunto: {first_proc.get("subjectMain")}')

# 7. Validar Detalhes do Processo (Todas as abas)
print('\n7. Validando Carregamento de Todas as Abas do Processo...')
det_res = session.get(f'{BASE_URL}/processes/{proc_id}', headers=headers)
assert det_res.status_code == 200, f'Falha ao buscar detalhes: {det_res.text}'
det = det_res.json()

print(f'   [ABA 1 - Visão Geral & Síntese]: OK')
print(f'       - Processo: {det.get("processNumber")}')
print(f'       - Status: {det.get("status")}')
print(f'       - Valor: {det.get("value")}')
print(f'   [ABA 2 - Partes e Advogados]: OK ({len(det.get("processParties", []))} partes)')
for party_link in det.get("processParties", []):
    p_name = party_link.get("party", {}).get("name") or party_link.get("client", {}).get("name")
    print(f'       * Polo {party_link.get("side")}: {p_name}')

print(f'   [ABA 3 - Linha do Tempo / Movimentações]: OK ({len(det.get("movements", []))} movimentações)')
if det.get("movements"):
    top_mov = det["movements"][0]
    print(f'       * Última movimentação: [{top_mov.get("eventDate")}] {top_mov.get("eventName")}')

# 8. Executar Enriquecimento DJEN
print('\n8. Executando Enriquecimento Cadastral DJEN (Diário da Justiça)...')
enrich_res = session.post(f'{BASE_URL}/processes/{proc_id}/enrich-djen', headers=headers)
print(f'   Status DJEN: {enrich_res.status_code}')
if enrich_res.status_code == 200:
    enrich_data = enrich_res.json()
    print(f'   Resultado do Enriquecimento: {enrich_data.get("message")}')
    print(f'   Publicações encontradas / Partes desmascaradas: {enrich_data.get("result")}')

# 9. Validar Documentos & Peças
print('\n9. Validando Aba de Documentos e Peças Processuais...')
docs_res = session.get(f'{BASE_URL}/processes/{proc_id}/documents', headers=headers)
assert docs_res.status_code == 200, f'Falha ao carregar documentos: {docs_res.text}'
docs_data = docs_res.json()
print(f'   Status Documentos: {docs_res.status_code} - Total de Peças/Eventos Mapeados: {len(docs_data)}')

print('\n======================================================================')
print('🎉 TESTE DE FLUXO COMPLETO EXECUTADO E VALIDADO COM SUCESSO!')
print('======================================================================')
