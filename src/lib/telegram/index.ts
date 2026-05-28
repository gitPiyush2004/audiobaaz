const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/** Send an HTML-formatted message. No-ops silently if token or chatId is missing. */
export async function sendTelegramMessage(chatId: string, html: string): Promise<void> {
  if (!BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' }),
    });
  } catch {
    // Notifications are best-effort — never throw
  }
}
