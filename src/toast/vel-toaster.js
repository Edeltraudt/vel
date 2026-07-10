// Toast markup, parsed once and cloned per toast. Static structure only:
// dynamic text is filled via textContent after cloning, never interpolated into
// this HTML (that would reopen the XSS hole the specs guard). The tone icon is a
// CSS `::before`, so it stays out of the markup and the accessibility tree.
const template = document.createElement("template");
template.innerHTML = `
	<div class="vel-toast">
		<div class="vel-toast__body">
			<p class="vel-toast__title"></p>
			<p class="vel-toast__desc" hidden></p>
		</div>
		<button class="vel-toast__action" type="button" hidden></button>
	</div>
`;
const toastProto = /** @type {HTMLElement} */ (template.content.firstElementChild);

/**
 * `<vel-toaster>` — host for transient "toast" notifications.
 *
 * Place one per page (near the end of `<body>`). It owns a single pair of
 * hidden live regions, decoupled from the visible toasts, so announcements are
 * reliable and never move focus (SC 4.1.3).
 *
 * Create toast:
 *   document.querySelector('vel-toaster').toast('Saved', { tone: 'success' });
 *
 * @element vel-toaster
 * @attr {number} duration - default auto-dismiss time in ms (default 5000)
 * @fires vel-dismiss - fired when a toast leaves; detail: { reason: 'timeout' | 'api' | 'action' }
 */
class VelToaster extends HTMLElement {
	/** @type {HTMLElement} visible stack */
	#stack;
	/** @type {HTMLElement} polite announcer (role=status) */
	#polite;
	/** @type {HTMLElement} assertive announcer (role=alert) */
	#assertive;

	connectedCallback() {
		this.#build();
	}

	#build() {
		if (this.#stack) {
			return;
		}

		this.#polite = this.#makeAnnouncer("status"); // status  => aria-live=polite
		this.#assertive = this.#makeAnnouncer("alert"); // alert => aria-live=assertive
		this.#stack = document.createElement("div");
		this.#stack.className = "vel-toaster__stack";
		this.append(this.#polite, this.#assertive, this.#stack);
	}

	/**
	 * Show a toast.
	 * @param {string} message - primary line, rendered as the toast's heading
	 * @param {object} [opts]
	 * @param {'info'|'success'|'warning'|'error'} [opts.tone] - visual + announce priority (default 'info')
	 * @param {number} [opts.duration] - auto-dismiss time in ms; overrides the `duration` attribute
	 * @param {string} [opts.description] - optional secondary line
	 * @param {{ label: string, onClick?: () => void }} [opts.action] - optional action button (e.g. Undo)
	 * @returns {HTMLElement} the toast element — pass to `dismiss()` to remove early
	 */
	toast(message, { tone = "info", duration, description, action } = {}) {
		this.#build();

		// Clone the static structure; fill every dynamic value via textContent.
		const el = /** @type {HTMLElement} */ (toastProto.cloneNode(true));
		el.dataset.tone = tone;
		this.#pick(el, ".vel-toast__title").textContent = message;

		if (description) {
			const desc = this.#pick(el, ".vel-toast__desc");
			desc.textContent = description;
			desc.hidden = false;
		}
		if (action) {
			const button = this.#pick(el, ".vel-toast__action");
			button.textContent = action.label;
			button.hidden = false;
			button.addEventListener("click", () => {
				action.onClick?.();
				this.dismiss(el, "action");
			});
		}

		this.#stack.append(el);

		// Errors announce assertively; everything else politely. The announcement
		// composes the visible lines and stays decoupled from the visible toast.
		// ponytail: surfacing the action's availability to AT, and holding an
		// actioned toast open long enough to reach it, is the accessible-undo pass
		// (DECISIONS.md SC 4.1.3) — deliberately not decided here.
		const announced = description ? `${message}. ${description}` : message;
		this.#announce(tone === "error" ? this.#assertive : this.#polite, announced);

		const attr = Number(this.getAttribute("duration"));
		const ms = duration ?? (attr > 0 ? attr : 5000);
		this.#scheduleDismiss(el, ms);
		return el;
	}

	/**
	 * Remove a toast now.
	 * @param {HTMLElement} el
	 * @param {'timeout'|'api'|'action'} [reason]
	 */
	dismiss(el, reason = "api") {
		if (!el?.isConnected) return;
		el.remove();
		this.dispatchEvent(new CustomEvent("vel-dismiss", { detail: { reason } }));
	}

	/**
	 * Query a node the template guarantees exists inside a cloned toast, so the
	 * result is treated as non-null.
	 * @param {HTMLElement} root
	 * @param {string} selector
	 * @returns {HTMLElement}
	 */
	#pick(root, selector) {
		return /** @type {HTMLElement} */ (root.querySelector(selector));
	}

	/**
	 * @param {"status" | "alert"} role
	 * @returns {HTMLElement}
	 */
	#makeAnnouncer(role) {
		const el = document.createElement("div");
		el.setAttribute("role", role); // role implies aria-live + aria-atomic
		el.className = "vel-sr-only";
		return el;
	}

	/**
	 * @param {HTMLElement} region
	 * @param {string} message
	 */
	#announce(region, message) {
		// ponytail: clear then re-set after a tick so identical consecutive
		// messages ("Saved" twice) register as a fresh mutation for assistive
		// tech. setTimeout (not rAF) so it still fires in a backgrounded tab.
		region.textContent = "";
		setTimeout(() => {
			region.textContent = message;
		}, 100);
	}

	/**
	 * @param {HTMLElement} el
	 * @param {number} duration
	 */
	#scheduleDismiss(el, duration) {
		let remaining = duration;
		let startedAt = 0;
		/** @type {ReturnType<typeof setTimeout>} */
		let timer;
		const start = () => {
			startedAt = performance.now();
			timer = setTimeout(() => this.dismiss(el, "timeout"), remaining);
		};
		const pause = () => {
			clearTimeout(timer);
			remaining -= performance.now() - startedAt;
		};
		// Pause the countdown while hovered or focused so readers keep their time (SC 2.2.1).
		el.addEventListener("mouseenter", pause);
		el.addEventListener("mouseleave", start);
		el.addEventListener("focusin", pause);
		el.addEventListener("focusout", start);
		start();
	}
}

customElements.define("vel-toaster", VelToaster);

export { VelToaster };
