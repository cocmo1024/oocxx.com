(() => {
	const roots = document.querySelectorAll("[data-share-tools]:not([data-share-ready])");

	for (const root of roots) {
		root.dataset.shareReady = "true";

		const title = root.dataset.shareTitle || document.title;
		const summary = root.dataset.shareSummary || "";
		const url = root.dataset.shareUrl || window.location.href;
		const nativeButton = root.querySelector('[data-share-action="native"]');
		const status = root.querySelector(".share-status");
		const shareData = { title, text: summary, url };
		let statusTimer;

		if (nativeButton && typeof navigator.share === "function") {
			nativeButton.hidden = false;
		}

		const showStatus = (message) => {
			if (!status) return;
			window.clearTimeout(statusTimer);
			status.textContent = message;
			statusTimer = window.setTimeout(() => {
				status.textContent = "";
			}, 3200);
		};

		const copyText = async (value) => {
			if (navigator.clipboard?.writeText && window.isSecureContext) {
				await navigator.clipboard.writeText(value);
				return;
			}

			const textarea = document.createElement("textarea");
			textarea.value = value;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.opacity = "0";
			document.body.appendChild(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			textarea.remove();
			if (!copied) throw new Error("Copy command failed");
		};

		root.addEventListener("click", async (event) => {
			const button = event.target.closest("[data-share-action]");
			if (!button) return;

			const action = button.dataset.shareAction;

			try {
				if (action === "native") {
					await navigator.share(shareData);
					return;
				}

				if (action === "copy-note") {
					const note = [title, summary, url].filter(Boolean).join("\n\n");
					await copyText(note);
					showStatus(root.dataset.copyNoteSuccess);
					return;
				}

				if (action === "copy-link") {
					await copyText(url);
					showStatus(root.dataset.copyLinkSuccess);
				}
			} catch (error) {
				if (error?.name !== "AbortError") showStatus(root.dataset.shareError);
			}
		});
	}
})();
