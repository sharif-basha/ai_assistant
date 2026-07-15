// Copyright (c) 2026, RySS / Common Ground Initiative and contributors
// For license information, please see license.txt

/**
 * Global AI assistant chat bubble. Injected on every Desk page. Auto-routes
 * questions: data questions go to the ai_insights ClickHouse pipeline (with SQL,
 * table, chart), general questions get a conversational Gemini answer. Includes
 * voice input and remembers the data conversation for follow-ups.
 */

(function () {
	// Only run inside the Desk app, once.
	if (!window.frappe || !frappe.boot || window.__aiAssistantLoaded) return;
	window.__aiAssistantLoaded = true;

	frappe.after_ajax(() => setTimeout(initAssistant, 1200));

	function initAssistant() {
		if (document.getElementById("ai-assistant-root")) return;
		injectStyles();

		const root = document.createElement("div");
		root.id = "ai-assistant-root";
		root.innerHTML = `
			<button class="aia-fab" title="Ask the assistant">💬</button>
			<div class="aia-panel" style="display:none;">
				<div class="aia-head">
					<span class="aia-title">Assistant</span>
					<span class="aia-actions">
						<button class="aia-clear" title="New chat">⟳</button>
						<button class="aia-close" title="Close">✕</button>
					</span>
				</div>
				<div class="aia-thread"></div>
				<div class="aia-composer">
					<textarea class="aia-input" rows="1" placeholder="Ask anything…"></textarea>
					<button class="aia-mic" title="Speak">🎤</button>
					<button class="aia-send">➤</button>
				</div>
			</div>`;
		document.body.appendChild(root);

		const panel = root.querySelector(".aia-panel");
		const thread = root.querySelector(".aia-thread");
		const input = root.querySelector(".aia-input");
		let conversation = null;

		root.querySelector(".aia-fab").onclick = () => {
			panel.style.display = panel.style.display === "none" ? "flex" : "none";
			if (panel.style.display === "flex") input.focus();
		};
		root.querySelector(".aia-close").onclick = () => (panel.style.display = "none");
		root.querySelector(".aia-clear").onclick = () => { thread.innerHTML = ""; conversation = null; greeting(); };
		root.querySelector(".aia-send").onclick = send;
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
		});
		input.addEventListener("input", function () {
			this.style.height = "auto";
			this.style.height = Math.min(this.scrollHeight, 120) + "px";
		});
		setupMic(root, input);
		greeting();

		function greeting() {
			bubble("assistant", "Hi! Ask me anything — general questions, or things about your data (I'll query the warehouse for those).");
		}

		function bubble(role, html) {
			const d = document.createElement("div");
			d.className = "aia-msg aia-" + role;
			d.innerHTML = `<div class="aia-b">${html}</div>`;
			thread.appendChild(d);
			thread.scrollTop = thread.scrollHeight;
			return d;
		}

		function esc(s) {
			return (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) =>
				({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
		}

		function md(t) {
			let h = esc(t);
			h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
			h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
			h = h.replace(/\n/g, "<br>");
			return h;
		}

		function send() {
			const q = input.value.trim();
			if (!q) return;
			input.value = "";
			input.style.height = "auto";
			bubble("user", esc(q));
			const thinking = bubble("assistant", '<span class="aia-dots">…</span>');

			frappe.call({
				method: "ai_assistant.api.assistant.chat",
				args: { message: q, mode: "auto", conversation },
				callback: (r) => {
					thinking.remove();
					const res = r.message;
					if (!res) { bubble("assistant", "No response."); return; }
					if (res.conversation) conversation = res.conversation;
					renderAnswer(res);
				},
				error: () => { thinking.remove(); bubble("assistant", "Something went wrong. Check the assistant settings."); },
			});
		}

		function renderAnswer(res) {
			let html = `<div class="aia-reply">${md(res.reply || "")}</div>`;
			if (res.kind === "data") {
				if (res.sql) html += `<details class="aia-sql"><summary>SQL</summary><pre>${esc(res.sql)}</pre></details>`;
				if (res.rows && res.rows.length) {
					const cols = Object.keys(res.rows[0]);
					let tbl = `<table class="aia-table"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>`;
					res.rows.slice(0, 20).forEach((row) => {
						tbl += `<tr>${cols.map((c) => `<td>${esc(row[c])}</td>`).join("")}</tr>`;
					});
					tbl += "</tbody></table>";
					html += `<details class="aia-data"><summary>Data (${res.row_count})</summary>${tbl}</details>`;
				}
			}
			const b = bubble("assistant", html);
			if (res.followups && res.followups.length) {
				const fu = document.createElement("div");
				fu.className = "aia-fu";
				res.followups.forEach((f) => {
					const chip = document.createElement("button");
					chip.className = "aia-chip";
					chip.textContent = f;
					chip.onclick = () => { input.value = f; send(); };
					fu.appendChild(chip);
				});
				b.querySelector(".aia-b").appendChild(fu);
			}
		}
	}

	function setupMic(root, input) {
		const mic = root.querySelector(".aia-mic");
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SR) { mic.style.display = "none"; return; }
		const rec = new SR();
		rec.lang = "en-IN";
		rec.interimResults = true;
		let on = false;
		rec.onresult = (e) => {
			let t = "";
			for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
			input.value = t;
			input.dispatchEvent(new Event("input"));
		};
		rec.onend = () => { on = false; mic.classList.remove("aia-mic-on"); };
		rec.onerror = () => { on = false; mic.classList.remove("aia-mic-on"); };
		mic.onclick = () => {
			if (on) { rec.stop(); return; }
			try { rec.start(); on = true; mic.classList.add("aia-mic-on"); } catch (e) {}
		};
	}

	function injectStyles() {
		if (document.getElementById("aia-styles")) return;
		const css = `
		#ai-assistant-root{position:fixed;bottom:24px;right:24px;z-index:1050;font-size:14px;}
		.aia-fab{width:52px;height:52px;border-radius:50%;border:none;background:#1B4332;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);}
		.aia-fab:hover{background:#2D6A4F;}
		.aia-panel{position:absolute;bottom:64px;right:0;width:380px;max-width:90vw;height:520px;max-height:75vh;background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.2);flex-direction:column;overflow:hidden;}
		.aia-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#1B4332;color:#fff;}
		.aia-title{font-weight:600;}
		.aia-actions button{background:transparent;border:none;color:#fff;cursor:pointer;font-size:15px;margin-left:8px;}
		.aia-thread{flex:1;overflow-y:auto;padding:12px;}
		.aia-msg{margin-bottom:10px;display:flex;}
		.aia-user{justify-content:flex-end;}
		.aia-b{max-width:85%;padding:9px 12px;border-radius:10px;line-height:1.45;}
		.aia-user .aia-b{background:#1B4332;color:#fff;}
		.aia-assistant .aia-b{background:var(--bg-light-gray,#f4f6f5);color:var(--text-color,#1a202c);}
		.aia-b code{background:#e6efe9;padding:1px 4px;border-radius:3px;}
		.aia-sql,.aia-data{margin-top:6px;font-size:12px;}
		.aia-sql summary,.aia-data summary{cursor:pointer;color:#40916C;font-weight:600;}
		.aia-sql pre{background:#0d1f17;color:#d7f0e2;padding:8px;border-radius:5px;overflow-x:auto;margin:4px 0 0;}
		.aia-table{border-collapse:collapse;margin-top:6px;font-size:11px;}
		.aia-table th,.aia-table td{border:1px solid var(--border-color,#dde3e0);padding:3px 6px;}
		.aia-fu{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
		.aia-chip{background:#eef5f1;border:1px solid #cfe6da;color:#1B4332;border-radius:14px;padding:4px 10px;font-size:11px;cursor:pointer;}
		.aia-composer{display:flex;gap:6px;align-items:flex-end;padding:10px;border-top:1px solid var(--border-color,#e2e8f0);}
		.aia-input{flex:1;resize:none;border:1px solid var(--border-color,#d1d8d4);border-radius:8px;padding:8px 10px;font-family:inherit;font-size:13px;max-height:120px;}
		.aia-mic,.aia-send{border:none;border-radius:8px;padding:0 12px;cursor:pointer;font-size:15px;}
		.aia-mic{background:var(--bg-light-gray,#f4f6f5);border:1px solid var(--border-color,#d1d8d4);}
		.aia-mic-on{background:#B23A48;color:#fff;}
		.aia-send{background:#1B4332;color:#fff;}
		.aia-dots{opacity:.6;}
		`;
		const s = document.createElement("style");
		s.id = "aia-styles";
		s.textContent = css;
		document.head.appendChild(s);
	}
})();
