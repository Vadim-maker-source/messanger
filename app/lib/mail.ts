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
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
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
    action === "change-password" ? `Talky: код для смены пароля — ${code}`
      : action === "reset-password" ? `Talky: код восстановления — ${code}`
      : `Talky: код подтверждения — ${code}`;

  const heading =
    action === "change-password" ? "Подтверждение смены пароля"
      : action === "reset-password" ? "Восстановление пароля"
      : "Код подтверждения";

  // Светлая тема — Gmail и другие почтовые клиенты её предпочитают.
  // Минимум inline-стилей, никаких подозрительных конструкций — снижает шанс
  // попадания в спам.
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f7;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:40px 32px 8px;text-align:center;">
              <div style="font-size:13px;color:#7c3aed;font-weight:700;letter-spacing:2px;">TALKY</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 16px;text-align:center;">
              <h1 style="margin:0;font-size:22px;color:#0a0a0c;font-weight:600;">${heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:15px;color:#666;line-height:1.55;">
                Используйте этот код для подтверждения.<br>Он действителен в течение 10 минут.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <div style="background:#f4f4f7;border:1px solid #e5e5e9;border-radius:12px;padding:24px;text-align:center;">
                <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#0a0a0c;font-family:'Courier New',monospace;">
                  ${code}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#999;line-height:1.55;">
                Если вы не запрашивали этот код — просто проигнорируйте письмо.<br>
                Никому не сообщайте этот код.
              </p>
            </td>
          </tr>
        </table>
        <div style="margin-top:16px;font-size:11px;color:#aaa;">
          © Talky · мессенджер
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `${heading}\n\nВаш код подтверждения: ${code}\n\nКод действителен 10 минут.\nЕсли вы не запрашивали — проигнорируйте письмо.\n\n— Talky`;

  await transporter.sendMail({
    from: `"Talky" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    replyTo: process.env.GMAIL_USER,
    headers: {
      "X-Entity-Ref-ID": code,
      "List-Unsubscribe": `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`,
    },
  });
}
