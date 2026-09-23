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
  const safeName = displayName.replace(/[<>&"']/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[character] || character,
  );
  const subject = "Your HansariaConnect OTP";
  const text = `Hi ${displayName},\n\nYour HansariaConnect verification code is ${otp}. It expires in 5 minutes.\n\nNever share this code with anyone. If you did not request it, you can ignore this email.`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HansariaConnect OTP</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;color:#202124;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f6f8fb;padding:36px 16px;">
      <tr>
        <td align="center">
          <table width="560" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #edf0f2;">
                <p style="margin:0;color:#188038;font-size:18px;font-weight:700;">HansariaConnect</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 32px 28px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:24px;">Hi ${safeName},</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:500;color:#202124;">Verify your email</h1>
                <p style="margin:0 0 26px;font-size:15px;line-height:24px;color:#5f6368;">Use this verification code to continue to HansariaConnect.</p>
                <div style="margin:0 0 26px;padding:18px;background:#f1f8f4;border:1px solid #c8e6d1;border-radius:8px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;line-height:16px;color:#5f6368;text-transform:uppercase;letter-spacing:1px;">Verification code</p>
                  <p style="margin:0;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:#188038;">${otp}</p>
                </div>
                <p style="margin:0;font-size:14px;line-height:22px;color:#5f6368;">This code expires in 5 minutes. Never share it with anyone.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#fafbfc;border-top:1px solid #edf0f2;color:#80868b;font-size:12px;line-height:18px;">
                If you did not request this code, you can safely ignore this email.<br />HansariaConnect security team
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
