import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase with service role key (bypasses RLS)
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (optional security measure)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Get all users with reminders enabled
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, reminder_email, reminder_time, timezone')
      .eq('reminders_enabled', true)
      .not('reminder_email', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    if (!users || users.length === 0) {
      return res.status(200).json({ message: 'No users with reminders enabled', sent: 0 });
    }

    // Filter users whose local time matches their reminder_time
    const usersToRemind = users.filter(user => {
      const userLocalHour = getUserLocalHour(currentHour, user.timezone);
      const reminderHour = parseInt(user.reminder_time?.split(':')[0] || '19');
      return userLocalHour === reminderHour;
    });

    if (usersToRemind.length === 0) {
      return res.status(200).json({
        message: 'No users to remind at this hour',
        sent: 0,
        totalEnabled: users.length
      });
    }

    // Check which users haven't uploaded today
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const emailsSent: string[] = [];
    const errors: { userId: string; error: string }[] = [];

    for (const user of usersToRemind) {
      // Check if user uploaded today
      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id')
        .eq('user_id', user.user_id)
        .gte('upload_date', today)
        .limit(1);

      if (photosError) {
        console.error(`Error checking photos for user ${user.user_id}:`, photosError);
        errors.push({ userId: user.user_id, error: photosError.message });
        continue;
      }

      // If user already uploaded today, skip
      if (photos && photos.length > 0) {
        continue;
      }

      // Send reminder email
      try {
        await resend.emails.send({
          from: 'Wizard of Oz <onboarding@resend.dev>', // Change to your domain once verified
          to: user.reminder_email!,
          subject: "Don't forget today's photo! 📸",
          html: generateEmailHTML(user.user_id),
        });

        emailsSent.push(user.reminder_email!);
      } catch (emailError) {
        console.error(`Failed to send email to ${user.reminder_email}:`, emailError);
        errors.push({
          userId: user.user_id,
          error: emailError instanceof Error ? emailError.message : String(emailError)
        });
      }
    }

    return res.status(200).json({
      message: 'Reminders sent successfully',
      sent: emailsSent.length,
      recipients: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Unexpected error in send-reminders:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function to convert UTC hour to user's local hour
function getUserLocalHour(utcHour: number, timezone: string): number {
  const now = new Date();
  now.setUTCHours(utcHour, 0, 0, 0);

  // Format the date in the user's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(part => part.type === 'hour');
  return parseInt(hourPart?.value || '0');
}

// Generate email HTML
function generateEmailHTML(userId: string): string {
  const appUrl = process.env.VITE_APP_URL || 'https://aperture-production.vercel.app';
  const uploadUrl = `${appUrl}?upload=true`;
  const settingsUrl = `${appUrl}?settings=true`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Photo Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h1 style="margin: 0; color: white; font-size: 32px;">📸</h1>
        <h2 style="margin: 10px 0 0 0; color: white; font-size: 24px; font-weight: 600;">Wizard of Oz</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Don't forget today's photo!</h2>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
          Hi there! 👋
        </p>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
          You haven't captured today's memory yet. Take a quick photo to keep your daily journey going!
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="${uploadUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Upload Today's Photo</a>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
          Keep the streak alive and watch your baby grow day by day! ✨
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; text-align: center;">
          You're receiving this because you have daily reminders enabled.
          <br>
          <a href="${settingsUrl}" style="color: #667eea; text-decoration: none;">Manage your settings</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
