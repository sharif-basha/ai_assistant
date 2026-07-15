# Copyright (c) 2026, RySS / Common Ground Initiative and contributors
# For license information, please see license.txt
"""Backend for the global AI assistant chat bubble.

A single ``chat`` endpoint auto-routes each question:
* **Data questions** about the ClickHouse warehouse are handed to the existing
  ``ai_insights`` app (reusing its Gemini key, model, schema, SQL guard and
  ClickHouse connection) so answers are grounded and safe.
* **General questions** go straight to Gemini for a conversational answer.

Routing is done by a fast Gemini classification call. All Gemini access and
credentials are reused from ``ai_insights`` - this app stores no keys of its own.
"""

from __future__ import annotations

import frappe
from frappe import _


def _ai_insights():
    """Import the reused pieces from ai_insights, or fail with a clear message."""
    try:
        from ai_insights.api import insights
        from ai_insights.gemini.client import generate
        return insights, generate
    except Exception as exc:  # noqa: BLE001
        frappe.throw(
            _("The ai_insights app is required for the assistant: {0}").format(exc)
        )


def _settings():
    return frappe.get_doc("AI Insights Settings")


def _classify(generate, api_key: str, model: str, question: str, has_tables: bool) -> str:
    """Return 'data' or 'general' for a question.

    If no queryable tables are configured, everything is 'general'.
    """
    if not has_tables:
        return "general"
    prompt = (
        "Classify the user's message as either DATA or GENERAL.\n"
        "DATA = it asks about records, counts, trends, or anything answerable "
        "from a database of the organisation's operational data.\n"
        "GENERAL = greetings, general knowledge, advice, or anything not about "
        "the organisation's stored data.\n"
        "Reply with exactly one word: DATA or GENERAL.\n\n"
        f"Message: {question}"
    )
    try:
        out = generate(api_key, model, prompt, temperature=0).strip().upper()
        return "data" if out.startswith("DATA") else "general"
    except Exception:  # noqa: BLE001 - if classification fails, treat as general
        return "general"


@frappe.whitelist()
def chat(message: str, mode: str = "auto", conversation: str | None = None) -> dict:
    """Answer a chat message, auto-routing data questions to ai_insights.

    Args:
        message: The user's message.
        mode: 'auto' (classify), 'data' (force data), or 'general' (force chat).
        conversation: Optional ai_insights conversation name for data follow-ups.

    Returns:
        A dict with ``reply`` (text), ``kind`` ('data'|'general'), and for data
        answers also ``sql``, ``rows``, ``row_count``, ``chart`` and
        ``conversation`` so the bubble can render the same rich output.
    """
    message = (message or "").strip()
    if not message:
        frappe.throw(_("Please enter a message."))

    insights, generate = _ai_insights()
    settings = _settings()
    api_key = settings.get_password("gemini_api_key")
    if not api_key:
        frappe.throw(_("Gemini API key is not configured in AI Insights Settings."))
    model = settings.model or "gemini-2.5-flash"

    # Determine routing.
    tables = insights._whitelisted_tables(settings)
    if mode == "data":
        kind = "data"
    elif mode == "general":
        kind = "general"
    else:
        kind = _classify(generate, api_key, model, message, bool(tables))

    if kind == "data":
        try:
            result = insights.ask(message, conversation=conversation)
            return {
                "kind": "data",
                "reply": result.get("insight", ""),
                "sql": result.get("sql"),
                "rows": result.get("rows", []),
                "row_count": result.get("row_count", 0),
                "chart": result.get("chart"),
                "followups": result.get("followups", []),
                "conversation": result.get("conversation"),
            }
        except Exception as exc:  # noqa: BLE001 - fall back to a general answer
            frappe.logger("ai_assistant").warning(f"data route failed: {exc}")
            # fall through to general

    # General conversational answer.
    system = (
        "You are a helpful assistant embedded in the RySS Frappe/ERPNext system. "
        "Be concise and practical. If a question seems to need the organisation's "
        "own data and you don't have it, say the user can ask a data question and "
        "you'll query the warehouse."
    )
    reply = generate(api_key, model, message, system_instruction=system, temperature=0.5)
    return {"kind": "general", "reply": reply}
