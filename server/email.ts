import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY is not set. Emails will not be sent.");
}

const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");
const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@muhammedmekky.com";

export async function sendOTP(email: string, otp: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Dev Mode] Would have sent OTP ${otp} to ${email}`);
    return { success: true };
  }

  try {
    const data = await resend.emails.send({
      from: `Workit.OS <${EMAIL_FROM}>`,
      to: email,
      subject: "Your Workit.OS Verification Code",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Welcome to Workit.OS!</h1>
          <p style="color: #555; font-size: 16px;">
            Please use the following 6-digit code to verify your email address and complete your registration:
          </p>
          <div style="background-color: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111;">${otp}</span>
          </div>
          <p style="color: #777; font-size: 14px;">
            This code will expire in 15 minutes. If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });

    if (data.error) {
      console.error("Resend API error:", data.error);
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error };
  }
}
