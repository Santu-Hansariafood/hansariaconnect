import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";

type MailerCache = {
  transporter: Transporter | null;
  warming: boolean;
};

declare global {
  // Reused across hot reloads in dev so the SMTP pool is not rebuilt.
  var mailerCache: MailerCache | undefined;
}

const cache: MailerCache = global.mailerCache || {
  transporter: null,
  warming: false,
};

global.mailerCache = cache;

const resolvePort = (): number =>
  Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);

const resolveSecure = (): boolean => {
  const flag = process.env.SMTP_SECURE ?? process.env.EMAIL_SECURE;
  if (flag) return flag === "true";
  // Port 465 starts TLS straight away, 587 upgrades with STARTTLS.
  return resolvePort() === 465;
};

const resolveUser = (): string | undefined =>
  process.env.SMTP_USER || process.env.EMAIL_USER;

export const mailFrom = (): string =>
  process.env.SMTP_FROM ||
  process.env.EMAIL_FROM ||
  resolveUser() ||
  "no-reply@hansariaconnect.com";

const getTransporter = (): Transporter => {
  if (!cache.transporter) {
    cache.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
      port: resolvePort(),
      secure: resolveSecure(),
      auth: {
        user: resolveUser(),
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
      // Keep authenticated connections alive. A fresh TCP + TLS + auth
      // handshake for every OTP is the slowest part of the request.
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      // Without these a wedged SMTP host can hold the request for minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  const transporter = cache.transporter;

  if (!cache.warming) {
    cache.warming = true;
    // Open the connection up front so the first real send does not pay for it.
    transporter.verify().catch((error: unknown) => {
      console.error(
        "[mailer] SMTP warm-up failed:",
        error instanceof Error ? error.message : String(error),
      );
    });
  }

  return transporter;
};

export const sendMail = async (options: SendMailOptions): Promise<void> => {
  await getTransporter().sendMail(options);
};
