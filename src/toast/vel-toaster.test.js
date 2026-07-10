import { fixture, html, expect, oneEvent, aTimeout } from "@open-wc/testing";
import "./vel-toaster.js";

const mount = () => fixture(html`<vel-toaster></vel-toaster>`);
const titleOf = (toast) => toast.querySelector(".vel-toast__title").textContent;

describe("vel-toaster", () => {
  it("is accessible", async () => {
    const el = await mount();
    el.toast("Saved", {
      tone: "success",
      description: "Your changes are stored.",
    });
    // Runs axe. May surface page-level best-practice rules (e.g. `region`) that
    // are about this bare test page, not the toast — scope with
    // `.to.be.accessible({ ignoredRules: ["region"] })` if so.
    await expect(el).to.be.accessible();
  });

  it("builds a polite (status) and an assertive (alert) live region", async () => {
    const el = await mount();
    expect(el.querySelector('[role="status"]'), "polite").to.exist;
    expect(el.querySelector('[role="alert"]'), "assertive").to.exist;
  });

  it("renders the message as the title, with the tone", async () => {
    const el = await mount();
    el.toast("Saved", { tone: "success" });
    const toast = el.querySelector(".vel-toast");
    expect(titleOf(toast)).to.equal("Saved");
    expect(toast.dataset.tone).to.equal("success");
  });

  it("omits description and action until provided", async () => {
    const el = await mount();
    el.toast("Saved");
    const toast = el.querySelector(".vel-toast");
    expect(toast.querySelector(".vel-toast__desc").hidden, "desc").to.be.true;
    expect(toast.querySelector(".vel-toast__action").hidden, "action").to.be.true;
  });

  it("shows a description and composes it into the announcement", async () => {
    const el = await mount();
    el.toast("Saved", { description: "Your changes are stored." });
    const desc = el.querySelector(".vel-toast__desc");
    expect(desc.hidden).to.be.false;
    expect(desc.textContent).to.equal("Your changes are stored.");
    await aTimeout(150);
    expect(el.querySelector('[role="status"]').textContent).to.equal(
      "Saved. Your changes are stored.",
    );
  });

  it("shows an action button, fires onClick, then dismisses with reason 'action'", async () => {
    const el = await mount();
    let undone = 0;
    const toast = el.toast("Deleted", {
      action: { label: "Undo", onClick: () => (undone += 1) },
    });
    const button = toast.querySelector(".vel-toast__action");
    expect(button.hidden).to.be.false;
    expect(button.textContent).to.equal("Undo");

    setTimeout(() => button.click());
    const ev = await oneEvent(el, "vel-dismiss");
    expect(undone, "onClick ran").to.equal(1);
    expect(ev.detail.reason).to.equal("action");
    expect(toast.isConnected).to.be.false;
  });

  it("routes error to the assertive region, everything else to polite", async () => {
    const el = await mount();
    el.toast("Boom", { tone: "error" });
    el.toast("FYI", { tone: "info" });
    await aTimeout(150); // #announce sets textContent ~100ms after clearing
    expect(el.querySelector('[role="alert"]').textContent).to.equal("Boom");
    expect(el.querySelector('[role="status"]').textContent).to.equal("FYI");
  });

  it("treats message, description, and action label as text, never markup (XSS guard)", async () => {
    const el = await mount();
    const payload = '<img src=x onerror="window.__velXss = true">';
    const toast = el.toast(payload, {
      description: payload,
      action: { label: payload },
    });
    expect(toast.querySelector("img"), "no element injected").to.not.exist;
    expect(titleOf(toast)).to.equal(payload);
    expect(toast.querySelector(".vel-toast__desc").textContent).to.equal(payload);
    expect(toast.querySelector(".vel-toast__action").textContent).to.equal(payload);
    expect(window.__velXss, "payload never executed").to.be.undefined;
  });

  it("shows one toast per call, including identical consecutive messages", async () => {
    const el = await mount();
    el.toast("Saved", { tone: "success" });
    el.toast("Saved", { tone: "success" });
    expect(el.querySelectorAll(".vel-toast")).to.have.lengthOf(2);
    await aTimeout(150);
    // ponytail: asserting the *reannounce* (clear→reset firing twice so AT
    // re-reads an identical string) needs a MutationObserver spy on the region.
    // Deferred — here we only assert the message lands. Add the spy if a
    // regression in the 100ms trick becomes a real risk.
    expect(el.querySelector('[role="status"]').textContent).to.equal("Saved");
  });

  it("dismiss() removes the toast and fires vel-dismiss with reason 'api'", async () => {
    const el = await mount();
    const toast = el.toast("Bye");
    setTimeout(() => el.dismiss(toast));
    const ev = await oneEvent(el, "vel-dismiss");
    expect(ev.detail.reason).to.equal("api");
    expect(toast.isConnected).to.be.false;
  });

  it("dismiss() on an already-removed toast is a no-op (no throw, no event)", async () => {
    const el = await mount();
    const toast = el.toast("Bye");
    el.dismiss(toast); // first dismiss removes it
    let fired = 0;
    el.addEventListener("vel-dismiss", () => (fired += 1));
    el.dismiss(toast); // second: not connected -> early return
    await aTimeout(0);
    expect(fired).to.equal(0);
    expect(toast.isConnected).to.be.false;
  });

  it("auto-dismisses after the duration with reason 'timeout'", async () => {
    const el = await mount();
    const toast = el.toast("Quick", { duration: 30 });
    const ev = await oneEvent(el, "vel-dismiss");
    expect(ev.detail.reason).to.equal("timeout");
    expect(toast.isConnected).to.be.false;
  });

  it("pauses the dismiss timer while hovered, resumes on leave (SC 2.2.1)", async () => {
    const el = await mount();
    const toast = el.toast("Hover me", { duration: 40 });
    toast.dispatchEvent(new MouseEvent("mouseenter"));
    await aTimeout(90); // well past 40ms
    expect(toast.isConnected, "stays while hovered").to.be.true;
    toast.dispatchEvent(new MouseEvent("mouseleave"));
    await oneEvent(el, "vel-dismiss");
    expect(toast.isConnected, "dismissed after leave").to.be.false;
  });

  it("per-call duration overrides the duration attribute", async () => {
    const el = await fixture(html`<vel-toaster duration="10000"></vel-toaster>`);
    const toast = el.toast("Fast", { duration: 30 });
    await oneEvent(el, "vel-dismiss"); // ~30ms, not 10s
    expect(toast.isConnected).to.be.false;
  });
});
