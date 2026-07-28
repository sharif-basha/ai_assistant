# AI Assistant

A floating chat assistant available on every ERPNext Desk page. Answers general
questions conversationally and routes data questions to `ai_insights`.

Built for RySS / APCNF to give staff a single in-Desk assistant for both
general help and data queries.

**Version:** 1.0.0 · **Frappe:** v15 · **License:** MIT

---

## What it does

- A **floating chat bubble** (bottom-right) injected on every Desk page.
- **Auto-routing**: general questions go to Gemini conversationally; data
  questions are routed to `ai_insights.api.insights.ask` (reusing its key, model
  and ClickHouse connection).
- **Voice input** and conversation memory; answer-only responses.

## Install

```bash
bench get-app ai_assistant https://github.com/sharif-basha/ai_assistant.git
bench --site <sitename> install-app ai_assistant
```

**Requires** the `ai_insights` app (for data-question routing and Gemini config).

## Notes

- The endpoint is `ai_assistant.api.assistant.chat`.
- A data question costs an extra Gemini call for classification (up to three
  calls total: classify → SQL → interpret).
- Styling is self-injected from JS so it does not depend on the desk CSS bundle.
