---
name: deploy-juriswatch
description: >-
  Use this skill when the user asks to deploy to production or publish the latest changes to the VPS.
  This skill will synchronize modified files and restart the Docker containers on the remote production server.
---

# Deploy Juriswatch to VPS

You must follow these steps to deploy the application to the VPS.

## Context
The application runs on a VPS at `31.97.83.42` using `docker-compose`. The codebase on the VPS is not a Git repository, so we must upload the modified files manually via SFTP before restarting the containers.

## Steps

### 1. Identify Modified Files
Check which files were modified locally that need to be uploaded to the VPS. You can use `git status` to see the uncommitted changes or files that were just modified.
If no files need to be synchronized, you can skip to step 2.

### 2. Execute the Deploy Script
A helper script is provided in this skill to handle the paramiko SSH connection, SFTP file transfer, and Docker restart.

Run the script from the root of the project (`c:\Users\luiz.beatrici\Desktop\Adv\juriswatch`).
Pass the relative paths of the files you want to sync as arguments.

Example:
```bash
python .agents/skills/deploy-juriswatch/scripts/deploy.py backend/prisma/schema.prisma frontend/src/utils/formatters.ts
```

If you just want to restart the containers without uploading files, run it without arguments:
```bash
python .agents/skills/deploy-juriswatch/scripts/deploy.py
```

### 3. Verify Success
Check the standard output of the Python script. It will print "Deploy finalizado com sucesso!" and display the Docker Compose logs if it worked. Report the success back to the user.
