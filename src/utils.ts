/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Custom dynamic sound synthesizer for new order alerts (double-chime boutique bell)
export function playNotificationChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioCtx.currentTime;

    // First note: high bright chime
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880.00, now); // A5 note
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);

    // Second note: warmer neon harmonic
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.10); // D6 note
    gain2.gain.setValueAtTime(0, now + 0.10);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now + 0.10);
    osc2.stop(now + 0.7);
  } catch (error) {
    console.warn("AudioContext failed or blocked by autoplay settings:", error);
  }
}

// Request and show HTML5 push notification
export function sendPushNotification(title: string, body: string) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%234c1d95'/><text x='35' y='65' fill='%23ccff00' font-size='45' font-weight='bold'>S</text></svg>"
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}

// Dynamic favicon drawing to inject high-contrast brand styling
export function injectBrandFavicon() {
  try {
    const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement("link");
    link.type = "image/x-icon";
    link.rel = "shortcut icon";

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      // Background (Purple)
      ctx.fillStyle = "#140728";
      ctx.fillRect(0, 0, 32, 32);

      // Inner Circle (Purple light)
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, 2 * Math.PI);
      ctx.fillStyle = "#4c1d95";
      ctx.fill();

      // Border (Neon Yellow)
      ctx.strokeStyle = "#ccff00";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text "S" (Neon Yellow)
      ctx.fillStyle = "#ccff00";
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", 16, 17);

      link.href = canvas.toDataURL("image/x-icon");
      document.getElementsByTagName("head")[0].appendChild(link);
    }
  } catch (e) {
    console.error("Failed to inject custom favicon:", e);
  }
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch (e) {
    return isoString;
  }
}

// Format date strictly as YYYY-MM-DD
export function formatToDateString(date: Date): string {
  const d = new Date(date);
  let month = "" + (d.getMonth() + 1);
  let day = "" + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}
