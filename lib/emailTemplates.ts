export interface OtpEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export const buildOtpEmailTemplate = (
  recipientName: string,
  otp: string,
): OtpEmailTemplate => {
  const displayName = recipientName?.trim() || "HansariaConnect User";
  const subject = "Your HansariaConnect OTP";
  const text = `Hello ${displayName},\n\nYour one-time password for HansariaConnect is: ${otp}\n\nThis code is valid for 5 minutes. If you did not request this, please ignore this message.\n\nThank you,\nHansariaConnect Team`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HansariaConnect OTP</title>
  </head>
  <body style="margin:0;padding:0;font-family:Inter,system-ui,Arial,sans-serif;background:#f5f7fb;color:#0f172a;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f5f7fb;padding:32px 0;">
      <tr>
        <td align="center">
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:32px;text-align:center;background:#0f172a;color:#ffffff;">
                <p style="margin:0;font-size:14px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">HansariaConnect</p>
                <h1 style="margin:12px 0 0;font-size:28px;font-weight:700;">One-Time Password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;color:#0f172a;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.75;">Hello ${displayName},</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.75;">Use the code below to complete your HansariaConnect registration. This code expires in 5 minutes.</p>
                <div style="margin:0 auto 24px;max-width:320px;padding:24px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:20px;text-align:center;">
                  <p style="margin:0;font-size:20px;color:#64748b;">Your verification code</p>
                  <p style="margin:16px 0 0;font-size:38px;font-weight:700;letter-spacing:0.2em;color:#0f172a;">${otp}</p>
                </div>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.75;">If you did not request this code, you can safely ignore this email. Do not share this code with anyone.</p>
                <a href="https://hfconnect.in" style="display:inline-block;padding:14px 28px;background:#0f172a;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;">Open HansariaConnect</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;color:#64748b;font-size:14px;line-height:1.75;border-top:1px solid #e2e8f0;">
                <p style="margin:0;">Need help? Reply to this email or visit our support page.</p>
                <p style="margin:12px 0 0;color:#94a3b8;">HansariaConnect Team</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};
