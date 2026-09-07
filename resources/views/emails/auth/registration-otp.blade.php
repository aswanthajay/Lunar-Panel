<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; width: 100%; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; background-color: #0A0A0A; border: 1px solid #1F1F1F; border-radius: 16px; overflow: hidden; text-align: left;">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 36px; background-color: #050505; border-bottom: 1px solid #141414;">
                            <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: #FFFFFF; letter-spacing: -0.5px;">votion</span>
                            <span style="font-size: 11px; color: #737373; margin-left: 8px; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">Security Verification</span>
                        </td>
                    </tr>
                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 36px 36px 24px 36px;">
                            <h2 style="font-size: 22px; font-weight: 500; color: #FFFFFF; margin: 0 0 12px 0; font-family: Georgia, serif;">Verify your email address</h2>
                            <p style="font-size: 13px; color: #A0A0A0; line-height: 1.6; margin: 0 0 28px 0;">
                                Hello {{ $name ?? 'there' }},<br><br>
                                Thank you for creating an account on Votion Cloud. Please use the six-digit verification code below to verify your email and activate your account:
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #000000; border: 1px solid #1F1F1F; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px;">
                                <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #10B981; display: inline-block;">{{ $otp }}</span>
                            </div>

                            <p style="font-size: 12px; color: #737373; line-height: 1.6; margin: 0;">
                                This code will expire in <strong>15 minutes</strong>. If you did not request this verification code, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 36px; background-color: #050505; border-top: 1px solid #141414; text-align: center;">
                            <p style="font-size: 11px; color: #525252; margin: 0; font-family: monospace;">
                                &copy; {{ date('Y') }} Votion Cloud Platform. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
