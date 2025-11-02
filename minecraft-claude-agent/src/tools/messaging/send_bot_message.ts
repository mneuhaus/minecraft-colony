import fs from 'fs';
import path from 'path';

export interface SendBotMessageParams {
  recipient: string;
  message: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Send a message to another bot asynchronously.
 * Messages are stored in files and the recipient can check them later.
 *
 * @param recipient - Name of the bot to send the message to
 * @param message - The message content
 * @param priority - Message priority (low/normal/high)
 * @returns Confirmation with message ID
 */
export async function send_bot_message(
  params: SendBotMessageParams
): Promise<string> {
  const { recipient, message, priority = 'normal' } = params;

  // Logging removed for simplicity

  try {
    const messagesDir = path.resolve(process.cwd(), 'messages');

    // Ensure messages directory exists
    if (!fs.existsSync(messagesDir)) {
      fs.mkdirSync(messagesDir, { recursive: true });
    }

    // Create message object
    const messageObj = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sender: process.env.BOT_NAME || 'unknown',
      recipient,
      message,
      priority,
      read: false,
    };

    // Write message to recipient's inbox file
    const inboxPath = path.join(messagesDir, `${recipient}.json`);
    let messages: typeof messageObj[] = [];

    if (fs.existsSync(inboxPath)) {
      const existing = fs.readFileSync(inboxPath, 'utf-8');
      messages = JSON.parse(existing);
    }

    messages.push(messageObj);

    fs.writeFileSync(inboxPath, JSON.stringify(messages, null, 2));

    // Message sent successfully

    return `Message sent to ${recipient} (ID: ${messageObj.id}). They will see it when they check messages.`;

  } catch (error: any) {
    // Error handled
    return `Failed to send message to ${recipient}: ${error.message}`;
  }
}
