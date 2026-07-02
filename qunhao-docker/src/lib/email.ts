import { Resend } from 'resend';
import { passwordResetEmailHtml, passwordResetEmailText } from './email-templates.js';

export async function sendPasswordResetEmail(opts: {
  apiKey: string;
  from: string;
  to: string;
  resetUrl: string;
  host: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = new Resend(opts.apiKey);
  const { error } = await resend.emails.send({
    from: opts.from,
    to: [opts.to],
    subject: '【群号】重置密码',
    html: passwordResetEmailHtml({ resetUrl: opts.resetUrl, host: opts.host }),
    text: passwordResetEmailText({ resetUrl: opts.resetUrl, host: opts.host }),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
