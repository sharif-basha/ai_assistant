# Copyright (c) 2026, RySS / Common Ground Initiative and contributors
"""Frappe app hooks for ai_assistant."""
from __future__ import annotations

app_name = "ai_assistant"
app_title = "AI Assistant"
app_publisher = "RySS / Common Ground Initiative"
app_description = "A global AI assistant chat bubble on every Desk page; general Q&A plus data questions routed to ai_insights."
app_email = "data@ryss.example.org"
app_license = "MIT"
app_version = "1.0.0"
required_apps = ["frappe", "ai_insights"]

# Inject the floating assistant on every Desk page.
app_include_js = ["/assets/ai_assistant/js/ai_assistant.js"]
app_include_css = ["/assets/ai_assistant/css/ai_assistant.css"]
