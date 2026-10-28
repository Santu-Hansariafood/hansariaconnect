export interface OtpEmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export type OtpEmailPurpose = "verification" | "admin";

export const buildOtpEmailTemplate = (
  recipientName: string,
  otp: string,
  purpose: OtpEmailPurpose = "verification",
): OtpEmailTemplate => {
  const displayName = recipientName?.trim() || "HansariaConnect User";
  const escapeHtml = (value: string) =>
    value.replace(/[<>&"']/g, (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character,
    );
  const title =
    purpose === "admin" ? "Admin sign-in code" : "Your verification code";
  const subject =
    purpose === "admin"
      ? "Your HansariaConnect admin sign-in code"
      : "Your HansariaConnect verification code";
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://hfconnect.in"
  ).replace(/\/+$/, "");
  const logoUrl = `${siteUrl}/favicon/android-chrome-192x192.png`;
  const safeName = escapeHtml(displayName);
  const safeOtp = escapeHtml(otp);
  const text = `Hi ${displayName},\n\nYour HansariaConnect ${purpose === "admin" ? "admin sign-in" : "verification"} code is:\n\n${otp}\n\nCopy and paste this code into HansariaConnect. It expires in 5 minutes and can only be used once. Never share it with anyone. HansariaConnect will never ask you to share this code. If you did not request it, you can ignore this email.`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <title>${title} | HansariaConnect</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f6f5;color:#172b24;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f3f6f5;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e3ebe7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;background-color:#087f5b;">
                <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="middle" style="padding-right:12px;">
                      <img src="${logoUrl}" width="44" height="44" alt="HansariaConnect logo" style="display:block;width:44px;height:44px;border:0;border-radius:8px;" />
                    </td>
                    <td valign="middle">
                      <p style="margin:0;color:#ffffff;font-size:19px;line-height:26px;font-weight:700;letter-spacing:0.2px;">HansariaConnect</p>
                      <p style="margin:4px 0 0;color:#d8f3e7;font-size:12px;line-height:18px;">Secure messaging</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px;">
                <p style="margin:0 0 8px;font-size:15px;line-height:22px;color:#52635b;">Hi ${safeName},</p>
                <h1 style="margin:0 0 10px;font-size:24px;line-height:32px;font-weight:700;color:#172b24;">${title}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:23px;color:#52635b;">Use the code below to securely continue to your HansariaConnect account.</p>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 22px;background-color:#f1f8f4;border:1px solid #d5e9dd;border-radius:8px;">
                  <tr>
                    <td align="center" style="padding:18px 12px;">
                      <p style="margin:0 0 7px;font-size:11px;line-height:16px;font-weight:700;color:#52635b;text-transform:uppercase;letter-spacing:1.5px;">One-time code</p>
                      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:#087f5b;">${safeOtp}</p>
                      <p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#52635b;">Select and copy this code, then paste it into the app.</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 10px;font-size:14px;line-height:22px;color:#34483e;"><strong>Expires in 5 minutes.</strong> This code can only be used once.</p>
                <p style="margin:0;font-size:14px;line-height:22px;color:#52635b;">Never share this code. HansariaConnect will never ask you to tell it to anyone.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background-color:#f8faf9;border-top:1px solid #e8eeeb;color:#66766e;font-size:12px;line-height:19px;">
                If you did not request this code, you can safely ignore this email. Your account will remain secure.<br />
                <span style="color:#087f5b;font-weight:700;">HansariaConnect Security</span>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;color:#7b8982;font-size:11px;line-height:17px;text-align:center;">This is an automated security email. Please do not reply.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};
