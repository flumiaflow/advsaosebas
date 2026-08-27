import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { prisma } from '../config/db';
import { decrypt } from './crypto';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const emailQueue = new Queue('emailQueue', { connection });

interface EmailJobData {
  tenantId: string;
  clientId: string;
  userId: string;
  userEmail: string;
  subject: string;
  htmlContent: string;
}

export const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    const { tenantId, clientId, userId, userEmail, subject, htmlContent } = job.data as EmailJobData;

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant || !tenant.smtpHost || !tenant.smtpPort || !tenant.smtpUser || !tenant.smtpPass) {
        throw new Error('SMTP não configurado para este tenant');
      }

      const password = decrypt(tenant.smtpPass);

      const transporter = nodemailer.createTransport({
        host: tenant.smtpHost,
        port: tenant.smtpPort,
        secure: tenant.smtpSecure,
        auth: {
          user: tenant.smtpUser,
          pass: password
        }
      });

      await transporter.sendMail({
        from: tenant.smtpFrom || tenant.smtpUser,
        to: userEmail,
        subject,
        html: htmlContent
      });

      // Registrar auditoria com sucesso
      await prisma.emailLog.create({
        data: {
          tenantId,
          clientId,
          userId,
          subject,
          status: 'success'
        }
      });

    } catch (error: any) {
      console.error(`Falha ao enviar e-mail (Job ${job.id}):`, error);

      // Registrar auditoria com erro
      await prisma.emailLog.create({
        data: {
          tenantId,
          clientId,
          userId,
          subject,
          status: 'error',
          errorReason: error.message || String(error)
        }
      });

      throw error; // Reprocessa no BullMQ se configurado retries
    }
  },
  { connection }
);

emailWorker.on('failed', (job, err) => {
  console.error(`Email Job ${job?.id} failed with error ${err.message}`);
});
