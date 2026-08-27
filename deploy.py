import paramiko
import os
import sys

# Ensure stdout uses utf-8
sys.stdout.reconfigure(encoding='utf-8')

ip = '31.97.83.42'
user = 'root'
passwd = '$Flow@Root2025#'
remote_dir = '/opt/juriswatch'
local_dir = r'c:\Users\luiz.beatrici\Desktop\Adv\juriswatch'

print(f"Conectando a {ip} para re-verificar deploy...")
try:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(ip, username=user, password=passwd, timeout=10)
    
    print("Reiniciando os containers Docker...")
    cmd = f"cd {remote_dir} && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    # Read output and ignore decode errors
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    print("--- DOCKER COMPOSE OUTPUT ---")
    print(out)
    if err:
        print("--- DOCKER COMPOSE ERRORS/LOGS ---")
        print(err)
        
    ssh.close()
    print("Deploy finalizado com sucesso!")
except Exception as e:
    print(f"Falha no deploy: {e}")
