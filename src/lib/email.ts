import nodemailer from "nodemailer";

/**
 * Mailer service resmi PPI Kabupaten Probolinggo
 * Menggunakan SMTP Gmail atau SMTP hosting lainnya.
 */
function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Mengirim email notifikasi registrasi berhasil
 */
export async function sendWelcomeEmail(toEmail: string, fullName: string, username: string) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP_USER atau SMTP_PASS belum diset di .env. Simulasi kirim welcome email ke:", toEmail);
    return false;
  }

  const loginUrl = "https://www.ppikabupatenprobolinggo.id/login";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #990000; margin: 0;">Purna Paskibraka Indonesia</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Kabupaten Probolinggo</p>
      </div>
      <div style="padding: 20px; background: #f8fafc; border-radius: 8px;">
        <h3 style="color: #1e293b; margin-top: 0;">Pendaftaran Akun Berhasil!</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Halo <strong>${fullName}</strong>,<br/>
          Selamat! Akun keanggotaan/panitia PPI Kabupaten Probolinggo Anda telah berhasil didaftarkan.
        </p>
        <div style="background: #ffffff; padding: 12px 16px; border-left: 4px solid #990000; margin: 16px 0; font-size: 13px;">
          <strong>Username / ID Anda:</strong> ${username}<br/>
          <strong>Email:</strong> ${toEmail}
        </div>
        <p style="color: #475569; font-size: 14px;">
          Silakan masuk ke portal resmi untuk mengakses sistem:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="background: #990000; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
            Buka Halaman Login
          </a>
        </div>
      </div>
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">
        Email ini dikirim otomatis oleh Sistem Resmi PPI Kabupaten Probolinggo. Jangan membalas email ini.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PPI Kab. Probolinggo" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: "Pendaftaran Akun Berhasil - PPI Kabupaten Probolinggo",
      html,
    });
    return true;
  } catch (err) {
    console.error("Gagal mengirim welcome email:", err);
    return false;
  }
}

/**
 * Mengirim kode OTP Lupa Password
 */
export async function sendOtpEmail(toEmail: string, fullName: string, otpCode: string) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP_USER atau SMTP_PASS belum diset di .env. Simulasi OTP:", otpCode, "ke:", toEmail);
    return false;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #990000; margin: 0;">Purna Paskibraka Indonesia</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Kabupaten Probolinggo</p>
      </div>
      <div style="padding: 20px; background: #f8fafc; border-radius: 8px; text-align: center;">
        <h3 style="color: #1e293b; margin-top: 0;">Kode Verifikasi (OTP) Reset Password</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Halo <strong>${fullName}</strong>,<br/>
          Kami menerima permintaan reset password untuk akun PPI Anda. Gunakan kode OTP 6 digit di bawah ini:
        </p>
        <div style="background: #ffffff; border: 2px dashed #990000; border-radius: 10px; padding: 16px; margin: 20px auto; max-width: 200px;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #990000; font-family: monospace;">
            ${otpCode}
          </span>
        </div>
        <p style="color: #ef4444; font-size: 12px; font-weight: bold;">
          Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun!
        </p>
      </div>
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">
        Jika Anda tidak merasa meminta reset password, abaikan email ini.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"PPI Kab. Probolinggo" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `[${otpCode}] Kode OTP Reset Password Akun PPI`,
      html,
    });
    return true;
  } catch (err) {
    console.error("Gagal mengirim OTP email:", err);
    return false;
  }
}

