// ─── Response Banks ───────────────────────────────────────────────────────────

const nahResponses = [
  { type: "text", value: "nah." },
  { type: "text", value: "nah mate." },
  { type: "text", value: "nah can't be stuffed honestly" },
  { type: "text", value: "yeah... no." },
  { type: "text", value: "lol nah" },
  { type: "text", value: "not today" },
  { type: "text", value: "nah I'm good" },
  { type: "text", value: "hard pass" },
  { type: "text", value: "mmmm no." },
  { type: "text", value: "nope" },
  { type: "text", value: "couldn't be me" },
  { type: "text", value: "nah brus" },
  { type: "text", value: "not vibing with that" },
  { type: "text", value: "I literally cannot care less rn" },
  { type: "text", value: "What's the question again?" },
  { type: "text", value: "naaaah" },
  { type: "text", value: "bro... no." },
  { type: "text", value: "zzz no" },
  { type: "text", value: "respectfully, no." },
  { type: "text", value: "actually? no." },
  { type: "text", value: "not a chance mate" },
    // ── Drop image/gif responses in here like this: ──────────────────────────
  { type: "image", value: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXN3NmpqejBsNGtmNm85ZzE2eGpjaDBsYWlrOGVvbzdmbDY5aHlneSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/NrqabhEpXWsGA/giphy.gif", alt: "bruh" },
  { type: "image", value: "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExd3AxZTg2dXA3dDJ3eHVxMnBwbGhvNTkzcDNldjhkOG40YnE2NzJuNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0Iy3yLzaEPZK4OCA/giphy.gif", alt: "peace out sucker" },
  { type: "image", value: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXdtYmozdDBzb2c5a3c0bG1zbGdjZ3g0dnl2am5kNnByNzM3bnZ4ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/9Vb9gWFgb9a4zUXDSW/giphy.gif", alt: "Baby saying no" },

];

const interruptResponses = [
  { type: "text", value: "yeah yeah we get it..." },
  { type: "text", value: "bro is still typing 💀" },
  { type: "text", value: "okay okay we get it" },
  { type: "text", value: "mate i stopped reading at word 5" },
  { type: "text", value: "novel incoming 😴" },
  { type: "text", value: "yap yap — not reading all that" },
   // ── Image interrupts: ───────────────────────────────────────────────────
  { type: "image", value: "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ21haDRwZHh3OHB0dG1jMGd2NWpvdG1tMnlyczlkNW5leHdld2h3dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/yyq0WXMv720OcpZvmA/giphy.gif", alt: "dog not impressed" },
  { type: "image", value: "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWpzeDEydjZzZ2IycWdxcHU5OWdtNWhiaGhiNzBtaGFwM3FqaWd3cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/0gIQqyDATQINBSpmO3/giphy.gif", alt: "I ain't reading all that frog" },
  { type: "image", value: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm1wZTllMmk3Y3pqdDZvOWZyZWd3MWgwYTd0NWxhOXFtbGVtdXh5MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/8SqOEkrr7Xlbl69Nc9/giphy.gif", alt: "you shush please now" },
  { type: "image", value: "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXRhaG52enZsbmp0eGZrcWNoMjB4ejZzc2Z6cnAyeDhvaDB1N2V2MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ARrQFpc6km5eU/giphy.gif", alt: "office monkey reading the news" },
];

const thinkingPhrases = [
  "God that was a stupid question",
  "Considered ignoring this entirely",
  "Briefly thought about a real answer. Decided against it.",
  "Ran 0 neural pathways on this one",
  "Thought about it for 0.003 seconds then nah'd",
  "Genuinely considered helping. Wild moment. Passed.",
  "Processing... just kidding, gave up immediately",
];

// ─── Config ───────────────────────────────────────────────────────────────────

const WORD_LIMIT = 6; // how many words before the interrupt fires

// ─── State ────────────────────────────────────────────────────────────────────

let interruptDiv = null;
let hasInterrupted = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const messagesEl = document.getElementById("messages");
const messagesInner = document.getElementById("messages-inner");
const typingWrap = document.getElementById("typing-wrap");
const input = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
let emptyState = document.getElementById("empty-state");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ─── Message Rendering ────────────────────────────────────────────────────────

/**
 * Creates a message bubble element.
 * @param {object} response - { type: "text"|"image", value: string, alt?: string }
 * @param {"user"|"ai"} role
 */
function createBubble(response, role) {
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (response.type === "image") {
    const img = document.createElement("img");
    img.src = response.value;
    img.alt = response.alt || "";
    img.className = "bubble-img";
    bubble.appendChild(img);
    bubble.classList.add("bubble-img-wrap");
  } else {
    bubble.textContent = response.value;
  }

  return bubble;
}

function addMsg(response, role, withThinking = false) {
  if (emptyState) {
    emptyState.remove();
    emptyState = null;
  }

  // Normalise plain strings into response objects
  if (typeof response === "string") {
    response = { type: "text", value: response };
  }

  const div = document.createElement("div");
  div.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "U" : "😑";

  const bubble = createBubble(response, role);
  div.appendChild(avatar);

  if (role === "ai" && withThinking) {
    const wrapper = document.createElement("div");
    wrapper.className = "ai-bubble-wrap";

    const thinkBtn = document.createElement("button");
    thinkBtn.className = "thinking-btn";
    const randomNumber = Math.floor(Math.random() * 5) + 1;
    thinkBtn.textContent = "Thought for: " + randomNumber + " seconds";

    const thinkDrop = document.createElement("div");
    thinkDrop.className = "thinking-drop";
    thinkDrop.textContent = getRandom(thinkingPhrases);

    thinkBtn.addEventListener("click", () => {
      thinkDrop.classList.toggle("open");
      thinkBtn.classList.toggle("active");
    });

    wrapper.appendChild(bubble);
    wrapper.prepend(thinkDrop);
    wrapper.prepend(thinkBtn);
    
    div.appendChild(wrapper);
  } else {
    div.appendChild(bubble);
  }

  messagesInner.appendChild(div);
  scrollBottom();
}

// ─── Interrupt Banner ─────────────────────────────────────────────────────────

function showInterrupt() {
  if (interruptDiv && interruptDiv.parentNode) return;

  const response = getRandom(interruptResponses);
  addMsg(response, "ai");
  playNotificationSound();
  scrollBottom();
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function showTyping() {
  messagesEl.prepend(typingWrap);
  typingWrap.classList.add("visible");
  scrollBottom();
}

function hideTyping() {
  typingWrap.classList.remove("visible");
}

// ─── Send Logic ───────────────────────────────────────────────────────────────

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  // clearInterrupt();
  hasInterrupted = false;
  input.value = "";
  input.style.height = "auto";

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const longMessage = wordCount > WORD_LIMIT;

  addMsg({ type: "text", value: text }, "user");
  showTyping();

  const delay = longMessage
    ? 3000 + Math.random() * 1000
    : 400 + Math.random() * 600;

  setTimeout(() => {
    hideTyping();
    addMsg(getRandom(nahResponses), "ai", longMessage);
    playNotificationSound();
  }, delay);
}


// ─── Notification Sound ──────────────────────────────────────────────────────────

function playNotificationSound() {
    const audio = new Audio('content/notifications/mixkit-message-pop-alert.mp3');
    audio.play().catch(error => {
        console.log("Audio playback failed. User may need to interact with the page first.", error);
    });
}

// ─── Input Listeners ──────────────────────────────────────────────────────────

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";

  const words = input.value.trim().split(/\s+/).filter(Boolean).length;

  if (words >= WORD_LIMIT) {
    if (!hasInterrupted) {
      hasInterrupted = true;
      showInterrupt();
    }
  }
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

// ─── Mobile Viewport Fix ─────────────────────────────────────────────────────

if (window.visualViewport) {
  const chatRoot = document.querySelector(".chat-root");
  function onViewportResize() {
    chatRoot.style.height = window.visualViewport.height + "px";
    scrollBottom();
  }
  window.visualViewport.addEventListener("resize", onViewportResize);
  window.visualViewport.addEventListener("scroll", onViewportResize);
}
