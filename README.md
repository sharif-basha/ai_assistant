# AI Assistant

A global AI assistant chat bubble on every Frappe **Desk** page. It answers
general questions conversationally, and **auto-routes data questions** to the
`ai_insights` app so they're answered from your ClickHouse warehouse (with SQL,
table, and chart) - reusing ai_insights' Gemini key, model, and connection.

## Features
- Floating chat bubble (bottom-right) on every Desk page.
- Auto-routing: general vs data questions, classified per message.
- Data answers show the SQL, a data table, and follow-up chips.
- Voice input (browser speech recognition) and data-conversation memory.
- Answer-only (does not modify data).

## Requirements
- Frappe v15
- The **ai_insights** app installed and configured (Gemini key + tables). This
  app reuses those settings - it stores no keys of its own.

## Install
```bash
bench get-app ai_assistant /path/to/ai_assistant
bench --site your-site install-app ai_assistant
bench --site your-site migrate
bench build --app ai_assistant
bench --site your-site clear-cache
```
Then hard-refresh Desk; the 💬 bubble appears bottom-right.

## Notes
- Routing uses a quick Gemini classification call, so each data question costs an
  extra small call. Force a mode by asking plainly ("just chat: …").
- Voice needs Chrome/Edge and microphone permission.

## License
MIT (c) 2026 RySS / Common Ground Initiative.
