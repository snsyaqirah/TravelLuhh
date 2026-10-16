package com.travelluhh.service;

import com.travelluhh.exception.EmailDeliveryException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;

/**
 * Sends the 6-digit codes. Plain, warm copy in the Tabung palette; no images, no emoji, nothing to track.
 */
@Slf4j
@Service
public class EmailService {

    static final String SEND_FAILED = "We couldn't send the email right now. Try again in a minute.";

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final int codeExpiryMinutes;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${app.email.from:${spring.mail.username:no-reply@travelluhh.local}}") String fromAddress,
            @Value("${app.email.verification-expiry-minutes:10}") int codeExpiryMinutes) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
        this.codeExpiryMinutes = codeExpiryMinutes;
    }

    /**
     * Sends now and throws {@link EmailDeliveryException} (503) if the mail server refuses, so the person
     * is never told a code is on its way when it isn't.
     */
    public void sendVerificationCode(String toEmail, String code, String purpose) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress, "TravelLuhh");
            helper.setTo(toEmail);

            boolean signup = "signup".equals(purpose);
            helper.setSubject(signup ? "Your TravelLuhh sign-up code" : "Your TravelLuhh password reset code");
            helper.setText(plainText(code, signup), html(code, signup));

            mailSender.send(message);
            log.info("Sent a '{}' code to {}", purpose, mask(toEmail));
        } catch (MessagingException | MailException | UnsupportedEncodingException e) {
            log.error("Could not send a '{}' code to {}: {}", purpose, mask(toEmail), e.getMessage());
            throw new EmailDeliveryException(SEND_FAILED, e);
        }
    }

    /**
     * Fire-and-forget variant for /forgot-password, whose response must look the same whether or not the
     * account exists. Failures are logged only.
     */
    @Async
    public void sendVerificationCodeAsync(String toEmail, String code, String purpose) {
        try {
            sendVerificationCode(toEmail, code, purpose);
        } catch (EmailDeliveryException e) {
            // already logged with the cause in sendVerificationCode
        } catch (RuntimeException e) {
            log.error("Unexpected failure sending a '{}' code to {}", purpose, mask(toEmail), e);
        }
    }

    // ── Templates ────────────────────────────────────────────────────────────

    private String plainText(String code, boolean signup) {
        String intro = signup
                ? "Let's open your first tabung.\n\nEnter this code in TravelLuhh to finish creating your account:"
                : "Let's get you back in.\n\nEnter this code in TravelLuhh to set a new password:";
        String outro = signup
                ? "Didn't try to sign up? You can ignore this email. Nobody can use your address without the code."
                : "Didn't ask for this? Ignore this email and your password stays as it is.";
        return intro + "\n\n    " + code + "\n\n"
                + "It works for the next " + codeExpiryMinutes + " minutes.\n\n"
                + outro + "\n\nTravelLuhh\n";
    }

    private String html(String code, boolean signup) {
        String heading = signup ? "Let's open your first tabung." : "Let's get you back in.";
        String lead = signup
                ? "Enter this code in TravelLuhh to finish creating your account."
                : "Enter this code in TravelLuhh to set a new password.";
        String outro = signup
                ? "Didn't try to sign up? You can ignore this email. Nobody can use your address without the code."
                : "Didn't ask for this? Ignore this email and your password stays as it is.";

        // Tokens from the Tabung spec: paper #F3EEE3, leaf #FBF8F1, ink #1D2420, ink-2 #4E5852, fund #17583F, rule #D6CCB8.
        return """
            <!doctype html>
            <html lang="en">
            <body style="margin:0;padding:0;background:#F3EEE3;">
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#F3EEE3;">
                <tr><td style="padding:32px 16px;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                         style="max-width:480px;margin:0 auto;background:#FBF8F1;border:1px solid #D6CCB8;border-radius:6px;">
                    <tr><td style="padding:28px 28px 8px 28px;">
                      <p style="margin:0 0 20px 0;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4E5852;">TravelLuhh</p>
                      <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;line-height:1.3;color:#1D2420;">%s</h1>
                      <p style="margin:0 0 20px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1D2420;">%s</p>
                      <p style="margin:0 0 20px 0;padding:16px 0;border-top:1px solid #D6CCB8;border-bottom:1px solid #D6CCB8;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:32px;letter-spacing:10px;color:#17583F;text-align:center;">%s</p>
                      <p style="margin:0 0 24px 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1D2420;">It works for the next %d minutes.</p>
                    </td></tr>
                    <tr><td style="padding:16px 28px 24px 28px;border-top:1px dashed #D6CCB8;">
                      <p style="margin:0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#4E5852;">%s</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(heading, lead, code, codeExpiryMinutes, outro);
    }

    /** s•••@gmail.com, so logs don't collect full addresses. */
    static String mask(String email) {
        if (email == null) return "";
        int at = email.indexOf('@');
        if (at <= 0) return "•••";
        return email.charAt(0) + "•••" + email.substring(at);
    }
}
