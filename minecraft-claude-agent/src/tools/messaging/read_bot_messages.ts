import fs from 'fs';
import path from 'path';

export interface ReadBotMessagesParams {
  mark_as_read?: boolean;
  only_unread?: boolean;
}

interface BotMessage {
  id: string;
  timestamp: string;
  sender: string;
  recipient: string;
  message: string;
  priority: 'low' | 'normal' | 'high';
  read: boolean;
}

/**
 * Read messages sent to this bot by other bots.
 *
 * @param mark_as_read - Mark retrieved messages as read (default: true)
 * @param only_unread - Only return unread messages (default: true)
 * @returns List of messages
 */
export async function read_bot_messages(
  params: ReadBotMessagesParams = {}
): Promise<string> {
  const { mark_as_read = true, only_unread = true } = params;

  const botName = process.env.BOT_NAME || 'unknown';

  // Reading messages

  try {
    const messagesDir = path.resolve(process.cwd(), 'messages');
    const inboxPath = path.join(messagesDir, `${botName}.json`);

    if (!fs.existsSync(inboxPath)) {
      return 'No messages found. Your inbox is empty.';
    }

    const existing = fs.readFileSync(inboxPath, 'utf-8');
    let messages: BotMessage[] = JSON.parse(existing);

    // Filter for unread if requested
    const messagesToReturn = only_unread
      ? messages.filter(m => !m.read)
      : messages;

    if (messagesToReturn.length === 0) {
      return only_unread
        ? 'No unread messages.'
        : 'No messages found.';
    }

    // Mark as read if requested
    if (mark_as_read) {
      messages = messages.map(m => {
        if (messagesToReturn.find(msg => msg.id === m.id)) {
          return { ...m, read: true };
        }
        return m;
      });
      fs.writeFileSync(inboxPath, JSON.stringify(messages, null, 2));
    }

    // Format messages for display
    const formatted = messagesToReturn.map(m => {
      const date = new Date(m.timestamp).toLocaleString();
      const priorityFlag = m.priority === 'high' ? '🔴 ' : m.priority === 'low' ? '🟢 ' : '';
      return `${priorityFlag}[${date}] From ${m.sender}:\n  ${m.message}\n  (ID: ${m.id})`;
    }).join('\n\n');

    // Messages retrieved

    return `You have ${messagesToReturn.length} message(s):\n\n${formatted}`;

  } catch (error: any) {
    // Error handled
    return `Failed to read messages: ${error.message}`;
  }
}
