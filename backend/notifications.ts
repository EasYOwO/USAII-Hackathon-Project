/**
 * User Notification Service
 * Sends SMS and email notifications to users
 * Supports multiple channels: SMS (Twilio), Email (SendGrid), and logging
 */

import type { Language, UserProfile } from './types';

// Environment variables for notification services
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@government-assistance.my';

/**
 * Message templates for different languages
 */
const MESSAGE_TEMPLATES = {
  zh_CN: {
    sessionStart: '欢迎使用政府补助金申请助手。请准备您的身份信息开始申请。',
    sessionComplete: '您的申请已完成。我们将在5个工作日内审核。',
    formRecommendation: '我们为您推荐以下补助金申请：{formName}。',
    dataConfirm: '请确认以下信息是否正确：{data}',
    error: '处理过程中出现错误。请稍后重试或联系客服。',
  },
  ms_MY: {
    sessionStart: 'Selamat datang ke pembantu permohonan subsidi kerajaan. Sila siapkan maklumat identiti anda untuk memulakan permohonan.',
    sessionComplete: 'Permohonan anda telah selesai. Kami akan menyemaknya dalam 5 hari kerja.',
    formRecommendation: 'Kami mengesyorkan permohonan subsidi berikut untuk anda: {formName}.',
    dataConfirm: 'Sila sahkan maklumat berikut adalah betul: {data}',
    error: 'Ralat dalam pemprosesan. Sila cuba lagi kemudian atau hubungi sokongan pelanggan.',
  },
  en_US: {
    sessionStart: 'Welcome to the Government Assistance Application Assistant. Please prepare your identification information to begin.',
    sessionComplete: 'Your application has been completed. We will review it within 5 business days.',
    formRecommendation: 'We recommend the following assistance application for you: {formName}.',
    dataConfirm: 'Please confirm the following information is correct: {data}',
    error: 'An error occurred during processing. Please try again later or contact customer support.',
  },
};

/**
 * Send SMS notification via Twilio
 */
async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  // If Twilio credentials not available, log message (for development)
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log(`[SMS LOG - Development Mode] To: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log('Note: Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER for production');
    return true; // Return success for development
  }

  try {
    const accountSid = TWILIO_ACCOUNT_SID;
    const authToken = TWILIO_AUTH_TOKEN;
    const fromNumber = TWILIO_PHONE_NUMBER;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.resource`;

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: phoneNumber,
        Body: message,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send SMS: ${response.statusText}`);
      return false;
    }

    console.log(`SMS sent successfully to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('SMS sending error:', error);
    return false;
  }
}

export async function sendSmsMessage(phoneNumber: string, message: string): Promise<boolean> {
  return sendSMS(phoneNumber, message);
}

/**
 * Send email notification via SendGrid
 */
async function sendEmail(email: string, subject: string, message: string): Promise<boolean> {
  // If SendGrid API key not available, log message (for development)
  if (!SENDGRID_API_KEY) {
    console.log(`[EMAIL LOG - Development Mode] To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Message: ${message}`);
    console.log('Note: Configure SENDGRID_API_KEY for production');
    return true; // Return success for development
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
            subject,
          },
        ],
        from: { email: SENDGRID_FROM_EMAIL },
        content: [
          {
            type: 'text/plain',
            value: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send email: ${response.statusText}`);
      return false;
    }

    console.log(`Email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
}

/**
 * Get localized message template
 */
function getTemplate(language: Language, templateKey: keyof (typeof MESSAGE_TEMPLATES)[Language]): string {
  const templates = MESSAGE_TEMPLATES[language] || MESSAGE_TEMPLATES.en_US;
  return templates[templateKey] || MESSAGE_TEMPLATES.en_US[templateKey] || '';
}

/**
 * Send session completion notification
 */
export async function sendCompletionNotification(
  phoneNumber: string,
  language: Language,
  collectedData: Record<string, any>,
): Promise<void> {
  try {
    // Prepare message
    const subject = {
      zh_CN: '您的政府补助金申请已提交',
      ms_MY: 'Permohonan Subsidi Kerajaan Anda Telah Dihantar',
      en_US: 'Your Government Assistance Application Has Been Submitted',
    };

    const message = getTemplate(language, 'sessionComplete');
    const emailSubject = subject[language] || subject.en_US;

    // Send SMS
    await sendSMS(phoneNumber, message);

    // If email available, send email too
    if (collectedData.email) {
      const emailMessage = `${message}\n\n${JSON.stringify(collectedData, null, 2)}`;
      await sendEmail(collectedData.email, emailSubject, emailMessage);
    }

    console.log(`Notifications sent for phone: ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending completion notification:', error);
  }
}

/**
 * Send form recommendation notification
 */
export async function sendFormRecommendation(
  phoneNumber: string,
  language: Language,
  formName: string,
  formDetails: Record<string, any>,
): Promise<void> {
  try {
    const template = getTemplate(language, 'formRecommendation');
    const message = template.replace('{formName}', formName);

    await sendSMS(phoneNumber, message);
    console.log(`Form recommendation sent to ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending form recommendation:', error);
  }
}

/**
 * Send data confirmation request
 */
export async function sendDataConfirmation(
  phoneNumber: string,
  language: Language,
  dataToConfirm: Record<string, any>,
): Promise<void> {
  try {
    const template = getTemplate(language, 'dataConfirm');
    const dataString = Object.entries(dataToConfirm)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    const message = template.replace('{data}', dataString);

    await sendSMS(phoneNumber, message);
    console.log(`Data confirmation request sent to ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending data confirmation:', error);
  }
}

/**
 * Send error notification
 */
export async function sendErrorNotification(phoneNumber: string, language: Language): Promise<void> {
  try {
    const message = getTemplate(language, 'error');
    await sendSMS(phoneNumber, message);
    console.log(`Error notification sent to ${phoneNumber}`);
  } catch (error) {
    console.error('Error sending error notification:', error);
  }
}

export const notificationService = {
  sendCompletionNotification,
  sendFormRecommendation,
  sendDataConfirmation,
  sendErrorNotification,
  sendSmsMessage,
};
