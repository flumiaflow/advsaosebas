import paramiko
import os
import sys

# Ensure stdout uses utf-8
sys.stdout.reconfigure(encoding='utf-8')

ip = '31.97.83.42'
user = 'root'
passwd = '$Flow@Root2025#'
remote_dir = '/opt/juriswatch'

# Pegar o diretório do projeto, onde o script foi chamado
local_dir = os.getcwd()

if len(sys.argv) > 1:
    files_to_sync = sys.argv[1:]
    print(f"Sincronizando {len(files_to_sync)} arquivos para a VPS...")
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=user, password=passwd, timeout=10)
        sftp = ssh.open_sftp()
        for file_path in files_to_sync:
            # limpar caminho se for absoluto
            if os.path.isabs(file_path):
                rel_path = os.path.relpath(file_path, local_dir)
            else:
                rel_path = file_path
                
            local_path = os.path.join(local_dir, rel_path.replace('/', '\\'))
            remote_path = f"{remote_dir}/{rel_path.replace('\\', '/')}"
            remote_folder = '/'.join(remote_path.split('/')[:-1])
            ssh.exec_command(f'mkdir -p {remote_folder}')
            
            sftp.put(local_path, remote_path)
            print(f"Uploaded: {rel_path}")
        sftp.close()
    except Exception as e:
        print(f"Falha no upload: {e}")
        sys.exit(1)
else:
    print("Nenhum arquivo especificado para sync. Apenas reiniciando containers...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(ip, username=user, password=passwd, timeout=10)

print("Reiniciando os containers Docker na VPS...")
cmd = f"cd {remote_dir} && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build"
stdin, stdout, stderr = ssh.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

print("--- DOCKER COMPOSE OUTPUT ---")
print(out)
if err:
    print("--- DOCKER COMPOSE ERRORS/LOGS ---")
    print(err)

ssh.close()
print("Deploy finalizado com sucesso!")
