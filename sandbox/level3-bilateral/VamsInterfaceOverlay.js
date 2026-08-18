const VAMS_PROFILES = {
  1: { emoji: "😴", text: "十分沉悶", color: "#b42318" },
  2: { emoji: "🥱", text: "有點沉悶", color: "#b42318" },
  3: { emoji: "🙁", text: "不太好玩", color: "#9a6700" },
  4: { emoji: "🙂", text: "可以接受", color: "#9a6700" },
  5: { emoji: "😐", text: "普通", color: "#475467" },
  6: { emoji: "😀", text: "頗好玩", color: "#067647" },
  7: { emoji: "😊", text: "很有興趣", color: "#067647" },
  8: { emoji: "🤩", text: "很吸引", color: "#175cd3" },
  9: { emoji: "🥳", text: "十分好玩", color: "#175cd3" },
  10: { emoji: "🔥", text: "極之好玩", color: "#6938ef" },
};

export class VamsInterfaceOverlay {
  constructor({ parent = document.body, onScoreSubmitted } = {}) {
    this.parent = parent;
    this.onScoreSubmitted = onScoreSubmitted;
    this.selectedScore = 5;
    this.overlay = null;
    this.previouslyFocused = null;
  }

  show() {
    document.getElementById("vams-modal-overlay")?.remove();
    this.previouslyFocused = document.activeElement;
    this.overlay = document.createElement("div");
    this.overlay.id = "vams-modal-overlay";
    this.overlay.className = "vams-overlay";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.setAttribute("aria-labelledby", "vams-title");
    this.overlay.setAttribute("aria-describedby", "vams-description");
    this.overlay.innerHTML = `
      <section class="vams-dialog">
        <p class="eyebrow">Session 結束評分</p>
        <h2 id="vams-title">剛才的復康活動，你覺得有幾好玩？</h2>
        <p id="vams-description">請選擇 1 至 10 分。1 代表十分沉悶，10 代表極之好玩。</p>
        <div class="vams-feedback" aria-live="polite">
          <span id="vams-emoji-display" class="vams-emoji" aria-hidden="true">😐</span>
          <strong id="vams-score-display">5 / 10</strong>
          <span id="vams-text-feedback">普通</span>
        </div>
        <label class="vams-slider-label" for="vams-slider">主觀享受度評分</label>
        <input
          id="vams-slider"
          class="vams-slider"
          type="range"
          min="1"
          max="10"
          value="5"
          step="1"
          aria-valuetext="5 分，普通"
          data-testid="input-vams-score"
        >
        <div class="vams-scale" aria-hidden="true">
          <span>1<br>十分沉悶</span>
          <span>5<br>普通</span>
          <span>10<br>極之好玩</span>
        </div>
        <button id="vams-submit-btn" class="button primary vams-submit" type="button" data-testid="button-submit-vams">
          確認並封存 Session
        </button>
        <p class="vams-note">此分數只記錄本次活動的主觀享受度，不是臨床診斷。</p>
      </section>
    `;
    this.parent.appendChild(this.overlay);
    this.initializeInteractions();
    this.overlay.querySelector("#vams-slider").focus();
    return this;
  }

  initializeInteractions() {
    const slider = this.overlay.querySelector("#vams-slider");
    const emojiDisplay = this.overlay.querySelector("#vams-emoji-display");
    const scoreDisplay = this.overlay.querySelector("#vams-score-display");
    const textFeedback = this.overlay.querySelector("#vams-text-feedback");
    const submitButton = this.overlay.querySelector("#vams-submit-btn");

    const updateVisuals = (rawValue) => {
      const value = Number(rawValue);
      const profile = VAMS_PROFILES[value];
      this.selectedScore = value;
      emojiDisplay.textContent = profile.emoji;
      scoreDisplay.textContent = `${value} / 10`;
      textFeedback.textContent = profile.text;
      textFeedback.style.color = profile.color;
      slider.setAttribute("aria-valuetext", `${value} 分，${profile.text}`);
    };

    slider.addEventListener("input", (event) => updateVisuals(event.target.value));
    submitButton.addEventListener("click", () => {
      const score = this.selectedScore;
      this.close();
      this.onScoreSubmitted?.(score);
    });
    this.overlay.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = [slider, submitButton];
      const currentIndex = focusable.indexOf(document.activeElement);
      const direction = event.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[nextIndex].focus();
    });
    updateVisuals(this.selectedScore);
  }

  close() {
    this.overlay?.remove();
    this.overlay = null;
    this.previouslyFocused?.focus?.();
  }
}
