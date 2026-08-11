export class TherapistDashboard {
  constructor({ onStartSession, onPause, onResume, onInvalidate, onEndSession }) {
    this.onStartSession = onStartSession;
    this.onPause = onPause;
    this.onResume = onResume;
    this.onInvalidate = onInvalidate;
    this.onEndSession = onEndSession;
    this.sessionActive = false;
    this.isPaused = false;
    this.isEnding = false;
    this.fields = [
      "patientId", "fthueLevel", "participantSequence", "blockOrderPosition",
      "experimentalCondition", "cognitiveTier",
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
    document.getElementById("participantSequence").addEventListener("change", () => this.syncCondition());
    document.getElementById("blockOrderPosition").addEventListener("change", () => this.syncCondition());
    this.startButton.addEventListener("click", () => this.start());
    this.pauseButton.addEventListener("click", () => this.togglePause());
    this.invalidateButton.addEventListener("click", () => this.onInvalidate?.());
    this.endButton.addEventListener("click", () => this.end());
  }

  syncCondition() {
    const sequence = document.getElementById("participantSequence").value;
    const blockPosition = Number(document.getElementById("blockOrderPosition").value);
    const conditions = sequence === "AB"
      ? ["SINGLE_TASK_BASELINE", "DUAL_TASK_INTERFERENCE"]
      : ["DUAL_TASK_INTERFERENCE", "SINGLE_TASK_BASELINE"];
    const condition = conditions[blockPosition - 1];
    document.getElementById("experimentalCondition").value = condition;
    document.getElementById("plannedDuration").textContent = condition === "SINGLE_TASK_BASELINE"
      ? "5 分鐘"
      : "8 分鐘";
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
      participantSequence: document.getElementById("participantSequence").value,
      blockOrderPosition: document.getElementById("blockOrderPosition").value,
      experimentalCondition: document.getElementById("experimentalCondition").value,
      cognitiveTier: document.getElementById("cognitiveTier").value,
      trialBlockNumber: document.getElementById("blockOrderPosition").value,
      therapistNotes: document.getElementById("therapistNotes").value.trim(),
      targetElevationDeg: document.getElementById("targetElevation").value,
      reachRangeProfile: document.getElementById("reachProfile").value,
      toleranceMode: document.getElementById("toleranceMode").value,
      patientLeftXSign: document.getElementById("directionMapping").value,
      vasFT0Mm: document.getElementById("vasFT0Mm").value,
      rpeT0Borg620: document.getElementById("rpeT0Borg620").value,
      vasFT1PreRestMm: document.getElementById("vasFT1PreRestMm").value,
      rpeT1PreRestBorg620: document.getElementById("rpeT1PreRestBorg620").value,
      vasFT1PostRestMm: document.getElementById("vasFT1PostRestMm").value,
      rpeT1PostRestBorg620: document.getElementById("rpeT1PostRestBorg620").value,
      vasFT2PostSessionMm: document.getElementById("vasFT2PostSessionMm").value,
      rpeT2PostSessionBorg620: document.getElementById("rpeT2PostSessionBorg620").value,
    };
  }

  setFormLock(locked) {
    this.fields.forEach((field) => { field.disabled = locked; });
    document.querySelectorAll('input[name="affectedSide"]').forEach((field) => { field.disabled = locked; });
    ["targetElevation", "reachProfile", "toleranceMode", "directionMapping"].forEach((id) => {
      document.getElementById(id).disabled = locked;
    });
    document.getElementById("experimentalCondition").disabled = true;
    if (!locked) this.syncCondition();
  }

  start() {
    const inputs = this.getFormInputs();
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(inputs.patientId)) {
      this.status.textContent = "匿名 ID 只可包含 3–40 個英文字母、數字、底線或連字號。";
      return;
    }
    const invalidInstrumentField = [...document.querySelectorAll(".fatigue-grid input")]
      .find((field) => !field.checkValidity());
    if (invalidInstrumentField) {
      invalidInstrumentField.reportValidity();
      this.status.textContent = "疲勞量尺超出容許範圍，請修正後再開始。";
      return;
    }
    try {
      this.onStartSession?.(inputs);
    } catch (error) {
      this.status.textContent = `未能開始 Session：${error.message}`;
      return;
    }
    this.sessionActive = true;
    this.isPaused = false;
    this.setFormLock(true);
    this.startButton.disabled = true;
    this.pauseButton.disabled = false;
    this.invalidateButton.disabled = false;
    this.endButton.disabled = false;
    this.status.textContent = `Session 已開始：${inputs.patientId} · ${inputs.participantSequence} Block ${inputs.blockOrderPosition}`;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.pauseButton.textContent = this.isPaused ? "繼續 Session" : "暫停 Session";
    this.status.textContent = this.isPaused ? "Session 已暫停；時間不會計入 MT 或 RT。" : "Session 已繼續。";
    if (this.isPaused) this.onPause?.();
    else this.onResume?.();
  }

  async end() {
    if (this.isEnding) return null;
    const invalidInstrumentField = [...document.querySelectorAll(".fatigue-grid input")]
      .find((field) => !field.checkValidity());
    if (invalidInstrumentField) {
      invalidInstrumentField.reportValidity();
      this.status.textContent = "疲勞量尺超出容許範圍；修正後才可結束及匯出。";
      return null;
    }
    let payload;
    this.isEnding = true;
    this.endButton.disabled = true;
    this.status.textContent = "請完成活動享受度評分，然後封存 Session。";
    try {
      payload = await this.onEndSession?.(this.getFormInputs());
    } catch (error) {
      this.status.textContent = `未能結束 Session：${error.message}`;
      this.endButton.disabled = false;
      this.isEnding = false;
      return null;
    }
    this.sessionActive = false;
    this.isPaused = false;
    this.setFormLock(false);
    this.syncCondition();
    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
    this.invalidateButton.disabled = true;
    this.endButton.disabled = true;
    this.isEnding = false;
    this.pauseButton.textContent = "暫停 Session";
    this.status.textContent = "Session 已結束；結構化資料可供匯出。";
    return payload;
  }
}
