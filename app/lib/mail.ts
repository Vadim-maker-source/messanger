import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_PASS не заданы в .env");
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: pass.replace(/\s+/g, "") },
  });

  return cachedTransporter;
}

interface SendCodeOptions {
  to: string;
  code: string;
  action?: string;
}

export async function sendVerificationEmail({ to, code, action }: SendCodeOptions) {
  const transporter = getTransporter();
  const subject =
    action === "change-password" ? "Подтверждение смены пароля"
      : action === "reset-password" ? "Восстановление пароля"
      : "Код подтверждения";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0a0c; padding:40px 20px;">
      <div style="max-width:480px; margin:0 auto; background:#16161b; border-radius:24px; padding:40px 32px; text-align:center;">
        <div style="font-size:14px; color:#9b87ff; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:16px;">
          Messenger
        </div>
        <h1 style="font-size:22px; color:#fff; margin:0 0 12px; font-weight:600;">
          ${subject}
        </h1>
        <p style="font-size:14px; color:rgba(255,255,255,0.5); margin:0 0 32px; line-height:1.5;">
          Используйте этот код для подтверждения. Он действителен в течение 10 минут.
        </p>
        <div style="background:#1f1f26; border-radius:16px; padding:24px; margin-bottom:24px;">
          <div style="font-size:36px; font-weight:700; letter-spacing:8px; color:#fff; font-family: 'Courier New', monospace;">
            ${code}
          </div>
        </div>
        <p style="font-size:12px; color:rgba(255,255,255,0.3); margin:0; line-height:1.5;">
          Если вы не запрашивали этот код — просто проигнорируйте письмо.
          Никому не сообщайте этот код.
        </p>
      </div>
      <div style="text-align:center; margin-top:16px; font-size:11px; color:rgba(255,255,255,0.25);">
        © Messenger
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Messenger" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: `${subject}\n\nВаш код: ${code}\n\nКод действителен 10 минут. Если вы не запрашивали — проигнорируйте письмо.`,
  });
}
