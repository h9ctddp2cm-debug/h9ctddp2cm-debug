export class TherapistDashboard {
  constructor({ onStartSession, onPause, onResume, onInvalidate, onEndSession }) {
    this.onStartSession = onStartSession;
    this.onPause = onPause;
    this.onResume = onResume;
    this.onInvalidate = onInvalidate;
    this.onEndSession = onEndSession;
    this.sessionActive = false;
    this.isPaused = false;
    this.fields = [
      "patientId", "fthueLevel", "experimentalCondition", "cognitiveTier",
      "trialBlockNumber", "therapistNotes",
    ].map((id) => document.getElementById(id));
    this.bindEvents();
    this.syncCondition();
  }

  bindEvents() {
    this.startButton = document.getElementById("startSession");
    this.pauseButton = document.getElementById("pauseSession");
    this.invalidateButton = document.getElementById("invalidateRep");
    this.endButton = document.getElementById("endSession");
    this.status = document.getElementById("sessionControlStatus");
    document.getElementById("experimentalCondition").addEventListener("change", () => this.syncCondition());
    this.startButton.addEventListener("click", () => this.start());
    this.pauseButton.addEventListener("click", () => this.togglePause());
    this.invalidateButton.addEventListener("click", () => this.onInvalidate?.());
    this.endButton.addEventListener("click", () => this.end());
  }

  syncCondition() {
    const condition = document.getElementById("experimentalCondition").value;
    const tier = document.getElementById("cognitiveTier");
    if (condition === "SINGLE_TASK_BASELINE") {
      tier.value = "NONE_CONTROL";
      tier.disabled = true;
    } else {
      tier.disabled = false;
      if (tier.value === "NONE_CONTROL") tier.value = "LOW_MATCHING";
    }
  }

  getFormInputs() {
    const affectedSide = document.querySelector('input[name="affectedSide"]:checked')?.value || "LEFT";
    return {
      patientId: document.getElementById("patientId").value.trim(),
      fthueLevel: document.getElementById("fthueLevel").value,
      affectedSide,
      experimentalCondition: document.getElementById("experimentalCondition").value,
      cognitiveTier: document.getElementById("cognitiveTier").value,
      trialBlockNumber: document.getElementById("trialBlockNumber").value,
      therapistNotes: document.getElementById("therapistNotes").value.trim(),
      targetElevationDeg: document.getElementById("targetElevation").value,
      reachRangeProfile: document.getElementById("reachProfile").value,
      toleranceMode: document.getElementById("toleranceMode").value,
      patientLeftXSign: document.getElementById("directionMapping").value,
    };
  }

  setFormLock(locked) {
    this.fields.forEach((field) => { field.disabled = locked; });
    document.querySelectorAll('input[name="affectedSide"]').forEach((field) => { field.disabled = locked; });
    ["targetElevation", "reachProfile", "toleranceMode", "directionMapping"].forEach((id) => {
      document.getElementById(id).disabled = locked;
    });
  }

  start() {
    const inputs = this.getFormInputs();
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(inputs.patientId)) {
      this.status.textContent = "匿名 ID 只可包含 3–40 個英文字母、數字、底線或連字號。";
      return;
    }
    this.sessionActive = true;
    this.isPaused = false;
    this.setFormLock(true);
    this.startButton.disabled = true;
    this.pauseButton.disabled = false;
    this.invalidateButton.disabled = false;
    this.endButton.disabled = false;
    this.status.textContent = `Session 已開始：${inputs.patientId} · Block ${inputs.trialBlockNumber}`;
    this.onStartSession?.(inputs);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.pauseButton.textContent = this.isPaused ? "繼續 Session" : "暫停 Session";
    this.status.textContent = this.isPaused ? "Session 已暫停；時間不會計入 MT 或 RT。" : "Session 已繼續。";
    if (this.isPaused) this.onPause?.();
    else this.onResume?.();
  }

  end() {
    const payload = this.onEndSession?.();
    this.sessionActive = false;
    this.isPaused = false;
    this.setFormLock(false);
    this.syncCondition();
    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
    this.invalidateButton.disabled = true;
    this.endButton.disabled = true;
    this.pauseButton.textContent = "暫停 Session";
    this.status.textContent = "Session 已結束；結構化資料可供匯出。";
    return payload;
  }
}
