import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger(__name__)

DEFAULT_SMTP_HOST = "smtp.gmail.com"
DEFAULT_SMTP_PORT = 587
DEFAULT_SMTP_USER = "hrjastraders@gmail.com"
DEFAULT_SMTP_PASSWORD = "gsqcjwgseviuodtp"
DEFAULT_ADMIN_RESET_EMAIL = "anwarjas123@gmail.com"


def get_admin_reset_email() -> str:
    return os.getenv("ADMIN_RESET_EMAIL", DEFAULT_ADMIN_RESET_EMAIL).strip().lower()


def send_password_reset_code_email(to_email: str, code: str, expires_in_minutes: int = 10) -> None:
    host = os.getenv("SMTP_HOST", DEFAULT_SMTP_HOST).strip()
    port = int(os.getenv("SMTP_PORT", str(DEFAULT_SMTP_PORT)))
    user = os.getenv("SMTP_USER", DEFAULT_SMTP_USER).strip()
    password = os.getenv("SMTP_PASSWORD", DEFAULT_SMTP_PASSWORD).strip()

    if not user or not password:
        raise RuntimeError("SMTP credentials are not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Fleet Admin - Password Reset Code: {code}"
    msg["From"] = f"JAS Traders Fleet <{user}>"
    msg["To"] = to_email

    text_content = f"""Hello Admin,

A password reset request was received for your Fleet account.

Your 6-digit verification code is:
{code}

This code is valid for {expires_in_minutes} minutes. If you did not request this code, you can safely ignore this email.

Regards,
JAS Traders Fleet System
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .card {{ max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #0284c7; padding: 24px; text-align: center; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
    .content {{ padding: 28px 24px; }}
    .code-box {{ margin: 24px 0; background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 18px; text-align: center; }}
    .code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #15803d; font-family: monospace; }}
    .note {{ font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
    .footer {{ text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Fleet Management System</h1>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Hello <strong>Admin</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #475569;">
        We received a request to reset your Fleet admin password. Enter the 6-digit verification code below in the Fleet app:
      </p>
      <div class="code-box">
        <div class="code">{code}</div>
      </div>
      <p style="font-size: 13px; color: #475569; margin: 0;">
        ⏳ This code will expire in <strong>{expires_in_minutes} minutes</strong>.
      </p>
      <div class="note">
        <strong>Did not request this?</strong> If you did not make this request, someone may have entered your email by mistake. Your account remains secure and no changes have been made.
      </div>
    </div>
  </div>
  <div class="footer">
    &copy; JAS Traders Fleet &bull; Automated notification
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls(context=context)
        server.login(user, password)
        server.send_message(msg)

    log.info("Sent password reset code email to %s", to_email)
