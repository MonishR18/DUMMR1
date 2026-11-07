import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, body: str, is_html: bool = False) -> bool:
    """Send an email using configured SMTP settings, or log to console/logger if not configured."""
    if not settings.SMTP_HOST:
        print("\n" + "="*60)
        print(f"[EMAIL DEV MODE - NO SMTP HOST CONFIGURED]")
        print(f"From: {settings.EMAIL_FROM}")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(body)
        print("="*60 + "\n")
        logger.info(f"[DEV EMAIL] Sent mock email to {to_email} with subject '{subject}'")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email

        mime_part = MIMEText(body, "html" if is_html else "plain")
        msg.attach(mime_part)

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

def send_verification_email(to_email: str, token: str) -> bool:
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your DUMMR account"
    body = f"""Welcome to DUMMR!

Please verify your email address to unlock full access to services, tasks, orders, and posts.

Click the link below or paste it into your browser:
{verification_url}

If you did not sign up for DUMMR, please ignore this email.
"""
    return send_email(to_email, subject, body)

def send_password_reset_email(to_email: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your DUMMR password"
    body = f"""Hello,

You requested a password reset for your DUMMR account.

Click the link below or paste it into your browser to reset your password:
{reset_url}

This link is valid for 15 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.
"""
    return send_email(to_email, subject, body)
