/* FTHUE Levels 3–4 — selected-arm shoulder-flexion controller.
   Level selection is made by an occupational therapist. This module does not
   diagnose or assign FTHUE levels. It observes only the selected anatomical
   shoulder/elbow chain; mirroring is a display concern and never swaps indices. */
(function (global) {
  'use strict';

  const CONFIG = {
    preAnchorFrames: 6,
    stableFrames: 8,
    windowFrames: 12,
    maxMadDeg: 2.8,
    maxSpanDeg: 8,
    minExcursionDeg: 8,
    startToleranceDeg: 8,
    gateStableFrames: 3,
    smoothAlpha: 0.42,
    returnAt: 0.16,
    targetToleranceDeg: 3,
    targetFeedbackMs: 800,
    shoulderHikeScale: 0.22,
    trunkLeanDeg: 16,
    anchorJumpScale: 1,
    safeguardStableFrames: 6,
    returnToleranceDeg: 10,
  };

  function clamp01(value) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  function median(values) {
    const sorted = values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  }
  function pointUsable(point) {
    return !!point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && (point.visibility == null || point.visibility >= 0.35);
  }
  function exerciseModeAvailable(level) {
    return String(level)==='3'||String(level)==='4';
  }
  function selectedArm(lm, side) {
    if (!Array.isArray(lm)) return null;
    const left = side === 'left';
    const arm = {
      shoulder:lm[left ? 11 : 12],
      elbow:lm[left ? 13 : 14],
      wrist:lm[left ? 15 : 16],
      otherShoulder:lm[left ? 12 : 11],
      hip:lm[left ? 23 : 24],
      otherHip:lm[left ? 24 : 23],
    };
    return [arm.shoulder,arm.elbow,arm.otherShoulder].every(pointUsable) ? arm : null;
  }
  function angleBetween(ax, ay, bx, by) {
    const an=Math.hypot(ax,ay), bn=Math.hypot(bx,by);
    if (an < 1e-5 || bn < 1e-5) return null;
    return Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/(an*bn))))*180/Math.PI;
  }
  // Angle of the upper arm away from the downward trunk axis. A side/oblique
  // camera is required; the value is an on-screen training estimate, not a
  // clinical goniometric measurement.
  function shoulderFlexion2D(arm, aspect) {
    if (!arm || !pointUsable(arm.elbow)) return null;
    const a=Number.isFinite(aspect) && aspect>.25 && aspect<4 ? aspect : 1;
    const hip=pointUsable(arm.hip) ? arm.hip : null;
    const tx=hip ? (hip.x-arm.shoulder.x)*a : 0;
    const ty=hip ? hip.y-arm.shoulder.y : 1;
    const ux=(arm.elbow.x-arm.shoulder.x)*a;
    const uy=arm.elbow.y-arm.shoulder.y;
    return angleBetween(tx,ty,ux,uy);
  }
  function shoulderFlexionWorld(worldLm,side) {
    const left=side==='left',shoulder=worldLm?.[left?11:12],elbow=worldLm?.[left?13:14],hip=worldLm?.[left?23:24];
    if(!pointUsable(shoulder)||!pointUsable(elbow)||!pointUsable(hip)) return null;
    const tx=hip.x-shoulder.x,ty=hip.y-shoulder.y,tz=(hip.z||0)-(shoulder.z||0);
    const ux=elbow.x-shoulder.x,uy=elbow.y-shoulder.y,uz=(elbow.z||0)-(shoulder.z||0);
    const tn=Math.hypot(tx,ty,tz),un=Math.hypot(ux,uy,uz);
    if(tn<1e-5||un<1e-5)return null;
    return Math.acos(Math.max(-1,Math.min(1,(tx*ux+ty*uy+tz*uz)/(tn*un))))*180/Math.PI;
  }
  function torsoSignature(arm, aspect) {
    if (!arm) return null;
    const a=Number.isFinite(aspect) && aspect>.25 && aspect<4 ? aspect : 1;
    const shoulderSpan=Math.hypot((arm.shoulder.x-arm.otherShoulder.x)*a,arm.shoulder.y-arm.otherShoulder.y);
    if (shoulderSpan < 1e-4) return null;
    const midpoint={x:(arm.shoulder.x+arm.otherShoulder.x)/2,y:(arm.shoulder.y+arm.otherShoulder.y)/2};
    const hipMid=pointUsable(arm.hip)&&pointUsable(arm.otherHip)
      ? {x:(arm.hip.x+arm.otherHip.x)/2,y:(arm.hip.y+arm.otherHip.y)/2} : null;
    const shoulderLineAngle=Math.atan2(
      (arm.shoulder.y-arm.otherShoulder.y),
      (arm.shoulder.x-arm.otherShoulder.x)*a
    )*180/Math.PI;
    const torsoLength=hipMid
      ? Math.hypot((midpoint.x-hipMid.x)*a,midpoint.y-hipMid.y) : null;
    const trunkLean=hipMid ? Math.atan2(
      (midpoint.x-hipMid.x)*a,
      hipMid.y-midpoint.y
    )*180/Math.PI : null;
    return {midpoint,otherShoulder:{x:arm.otherShoulder.x,y:arm.otherShoulder.y},
      selectedShoulder:{x:arm.shoulder.x,y:arm.shoulder.y},hipMid,shoulderSpan,
      aspect:a,trunkLean};
  }
  function relation(anchor,current) {
    if (!anchor || !current) return null;
    const scale=Math.max(.05,anchor.shoulderSpan);
    let torsoShapeChange=0;
    if(anchor.hipMid&&current.hipMid){
      const avx=(anchor.otherShoulder.x-anchor.hipMid.x)*anchor.aspect;
      const avy=anchor.otherShoulder.y-anchor.hipMid.y;
      const cvx=(current.otherShoulder.x-current.hipMid.x)*current.aspect;
      const cvy=current.otherShoulder.y-current.hipMid.y;
      const al=Math.max(.01,Math.hypot(avx,avy));
      const cl=Math.max(.01,Math.hypot(cvx,cvy));
      const aa=Math.atan2(avx,-avy)*180/Math.PI;
      const ca=Math.atan2(cvx,-cvy)*180/Math.PI;
      torsoShapeChange=Math.max(
        Math.abs(Math.log(cl/al))/Math.log(1.6),
        Math.abs(ca-aa)/35
      );
    }
    const relativeShoulderRise=(
      (current.otherShoulder.y-current.selectedShoulder.y)
      -(anchor.otherShoulder.y-anchor.selectedShoulder.y)
    )/scale;
    return {
      // Translation of the whole patient in the camera image is not an
      // identity change. Compare torso shape/rotation instead of absolute
      // screen position so ordinary repositioning does not freeze a session.
      anchorJump:torsoShapeChange,
      shoulderHike:relativeShoulderRise,
      // Compare with the participant's stable starting posture. A natural,
      // unchanged seated lean must not permanently block calibration.
      trunkLean:Number.isFinite(anchor.trunkLean)&&Number.isFinite(current.trunkLean)
        ? Math.abs(current.trunkLean-anchor.trunkLean) : 0,
    };
  }
  function stability(samples, config) {
    const values=samples.map(sample=>sample.angle);
    const centre=median(values);
    if (!Number.isFinite(centre)) return {stable:false,median:null,mad:null,span:null};
    const mad=median(values.map(value=>Math.abs(value-centre))) || 0;
    const sorted=values.slice().sort((a,b)=>a-b);
    const span=sorted[sorted.length-1]-sorted[0];
    return {stable:samples.length>=config.stableFrames && mad<=config.maxMadDeg && span<=config.maxSpanDeg,
      median:centre,mad,span};
  }

  function createController(options) {
    const config=Object.assign({},CONFIG,options||{});
    const state={};
    function normalizeExerciseMode(mode) {
      return mode==='assisted-stick'?'assisted-stick':'active';
    }
    function defaultTarget(level){ return String(level)==='4'?60:40; }
    function startChoices(level,target){
      const pool=[0,10,20];
      return pool.filter(value=>value<=Number(target)-10);
    }
    function nextRandomStart(previous){
      const pool=startChoices(state.level,state.selectedTargetDeg);
      const alternatives=pool.length>1?pool.filter(value=>value!==previous):pool;
      state.seed=(state.seed*1664525+1013904223)>>>0;
      return alternatives[Math.floor((state.seed/4294967296)*alternatives.length)]??pool[0]??0;
    }
    function reset(level,targetDeg) {
      Object.assign(state,{level:String(level||'3'),phase:'anchor',reason:'awaiting-patient',
        calibrated:false,gameReady:false,framingReady:false,
        side:(options&&options.side==='left')?'left':((options&&options.side==='right')?'right':null),
        lastGeneration:null,
        exerciseMode:normalizeExerciseMode(state.exerciseMode||(options&&options.exerciseMode)),
        trackingTarget:'selected-anatomical-affected-arm',unaffectedHandFallback:false,
        preSamples:[],anchor:null,samples:[],baseline:null,maximum:null,trainingMin:null,trainingMax:null,
        seed:0x5f3759df,selectedStartDeg:0,
        selectedTargetDeg:Number(targetDeg)||defaultTarget(level||'3'),peakEstimatedAngle:null,
        targetReached:false,repetitions:0,cycleArmed:false,targetStableFrames:0,returnStableFrames:0,
        holdDurationMs:Math.max(0,Number(options&&options.holdDurationMs)||0),
        holdStartedAtMs:null,holdRemainingSec:null,holdComplete:false,holdRestartCount:0,
        holdAtTarget:false,holdInterrupted:false,lastUpdateMs:null,
        startStableFrames:0,
        rawAngle:null,worldAngle:null,filteredAngle:null,estimatedAngle:null,
        observedTargetAngle:null,prescribedExcursionDeg:null,
        signalSource:'image-2d-relative',progress:0,newFrame:false,compensation:null,
        anchorJumpFrames:0,shoulderHikeFrames:0,trunkLeanFrames:0,
        frame:{fresh:false,generation:null,ageMs:null,reason:'awaiting-decoded-frame'}});
      state.selectedStartDeg=nextRandomStart(null);
      return snapshot();
    }
    reset(options && options.level);
    function failClosed(reason) {
      state.gameReady=false; state.newFrame=false; state.reason=reason;
      state.startStableFrames=0; state.targetStableFrames=0; state.returnStableFrames=0;
      if(state.phase==='target-hold'){
        state.holdStartedAtMs=null;state.holdRemainingSec=null;state.holdComplete=false;
        state.holdAtTarget=false;state.holdInterrupted=true;
      }
      if (!state.calibrated) state.samples=[];
    }
    function update(packet) {
      const input=packet||{};
      const fresh=input.frameFresh===true || input.frame?.fresh===true;
      const generation=input.frameGeneration ?? input.frame?.generation;
      const currentTime=Number.isFinite(input.nowMs)?input.nowMs:generation*(1000/30);
      state.frame={fresh,generation,ageMs:input.frame?.ageMs??null,
        reason:input.frame?.reason||(fresh?'fresh-decoded-frame':'frame-stale')};
      if (!fresh) { failClosed('frame-stale'); state.framingReady=false; return snapshot(); }
      if (!Number.isFinite(generation)
        || (Number.isFinite(state.lastGeneration) && generation<=state.lastGeneration)) {
        state.newFrame=false; return snapshot();
      }
      const packetSide=input.side==='left'?'left':'right';
      if (state.side && packetSide!==state.side) {
        state.framingReady=false; failClosed('selected-side-mismatch'); return snapshot();
      }
      if (!state.side) state.side=packetSide;
      state.lastGeneration=generation; state.newFrame=true;
      // Never accept an arbitrary arm override here. In active-assisted stick
      // mode the opposite hand can be close to the affected wrist, but it is
      // assistance only and must never become a tracking fallback or target.
      const arm=selectedArm(input.lm,state.side);
      if (!arm) { state.framingReady=false; failClosed('selected-arm-lost'); return snapshot(); }
      const imageAngle=shoulderFlexion2D(arm,input.imageAspect);
      const worldAngle=shoulderFlexionWorld(input.worldLm,state.side);
      // The front/oblique camera's world model can report a large person- and
      // viewpoint-dependent offset. Use the visible selected upper-arm angle
      // consistently for control and retain world 3D only as a diagnostic.
      const angle=imageAngle;
      const signature=torsoSignature(arm,input.imageAspect);
      if (!Number.isFinite(angle)||!signature) { state.framingReady=false; failClosed('selected-arm-lost'); return snapshot(); }
      state.framingReady=true; state.rawAngle=angle;state.worldAngle=worldAngle;
      state.lastUpdateMs=currentTime;
      state.signalSource='image-2d-relative';
      if (!state.anchor) {
        state.preSamples.push(signature);
        while(state.preSamples.length>config.preAnchorFrames) state.preSamples.shift();
        if(state.preSamples.length>=config.preAnchorFrames) {
          state.anchor=state.preSamples[Math.floor(state.preSamples.length/2)];
          state.phase='capture-baseline'; state.reason='hold-comfortable-start';
        }
      }
      if (!state.anchor) return snapshot();
      const rel=relation(state.anchor,signature);
      state.anchorJumpFrames=rel&&rel.anchorJump>config.anchorJumpScale
        ? state.anchorJumpFrames+1 : 0;
      if (!rel || state.anchorJumpFrames>=config.safeguardStableFrames) {
        failClosed('torso-moved/person-changed'); return snapshot();
      }
      state.shoulderHikeFrames=rel.shoulderHike>config.shoulderHikeScale
        ? state.shoulderHikeFrames+1 : 0;
      state.trunkLeanFrames=rel.trunkLean>config.trunkLeanDeg
        ? state.trunkLeanFrames+1 : 0;
      // From a single tablet view, ordinary humeral elevation can make the
      // selected shoulder landmark rise. Report this for therapist review but
      // do not freeze otherwise valid selected-arm movement.
      state.compensation=state.shoulderHikeFrames>=config.safeguardStableFrames
        ? 'shoulder-hike-observed' : null;
      if (state.trunkLeanFrames>=config.safeguardStableFrames) {
        state.compensation='trunk-lean'; failClosed('movement-safeguard-trunk-lean'); return snapshot();
      }
      state.samples.push({angle,generation});
      while(state.samples.length>config.windowFrames) state.samples.shift();
      const stable=stability(state.samples,config);
      if(state.phase==='capture-baseline' && stable.stable) {
        // This is an observed camera zero, not a claim that the camera has
        // measured an anatomical 0°. A stable arm-by-side pose may appear as
        // 20–30° in a front/oblique tablet view.
        state.baseline=stable.median;
        state.samples=[]; state.phase='await-start';
        state.trainingMin=state.selectedStartDeg;
        state.trainingMax=state.selectedTargetDeg;
        state.prescribedExcursionDeg=state.selectedTargetDeg-state.selectedStartDeg;
        state.observedTargetAngle=state.baseline+state.selectedTargetDeg;
        state.calibrated=true;state.gameReady=true;state.reason='ready';
        state.filteredAngle=angle;state.estimatedAngle=0;state.peakEstimatedAngle=0;
        state.progress=clamp01((state.estimatedAngle-state.trainingMin)
          /(state.trainingMax-state.trainingMin));
        state.startStableFrames=0;
        state.returnStableFrames=0;
        return snapshot();
      }
      if(state.calibrated) {
        state.filteredAngle=Number.isFinite(state.filteredAngle)
          ? state.filteredAngle+config.smoothAlpha*(angle-state.filteredAngle) : angle;
        // Map the observed arm-down baseline to training zero while preserving
        // a reachable overhead endpoint. Plain subtraction makes 180° impossible
        // whenever the front/oblique camera reports a non-zero resting offset.
        const cameraSpan=Math.max(30,180-state.baseline);
        state.estimatedAngle=Math.max(0,Math.min(180,
          (state.filteredAngle-state.baseline)*180/cameraSpan
        ));
        state.progress=clamp01((state.estimatedAngle-state.trainingMin)/(state.trainingMax-state.trainingMin));
        state.peakEstimatedAngle=Math.max(state.peakEstimatedAngle??state.estimatedAngle,state.estimatedAngle);
        const returnWindow=Math.min(
          config.returnToleranceDeg,
          Math.max(5,(state.trainingMax-state.trainingMin)*config.returnAt)
        );

        if(state.phase==='await-start'){
          const atStart=state.estimatedAngle>=Math.max(0,state.selectedStartDeg-config.startToleranceDeg)
            && state.estimatedAngle<=state.selectedStartDeg+returnWindow;
          state.startStableFrames=atStart?state.startStableFrames+1:0;
          state.targetStableFrames=0; state.returnStableFrames=0;
          if(state.startStableFrames>=config.gateStableFrames){
            state.phase='outward'; state.startStableFrames=0;
          }
        }else if(state.phase==='outward'){
          state.targetStableFrames=state.estimatedAngle>=state.selectedTargetDeg-config.targetToleranceDeg
            ? state.targetStableFrames+1:0;
          state.returnStableFrames=0;
          if(state.targetStableFrames>=config.gateStableFrames){
            state.targetReached=true; state.cycleArmed=true;
            state.holdComplete=state.holdDurationMs<=0;
            state.holdStartedAtMs=state.holdDurationMs>0
              ? currentTime+config.targetFeedbackMs : null;
            state.holdRemainingSec=state.holdDurationMs>0
              ? Math.ceil(state.holdDurationMs/1000) : null;
            state.holdAtTarget=true;state.holdInterrupted=false;
            state.phase=state.holdDurationMs>0?'target-hold':'await-return';
          }
        }else if(state.phase==='target-hold'){
          const atTarget=state.estimatedAngle>=state.selectedTargetDeg-config.targetToleranceDeg;
          state.targetStableFrames=atTarget?state.targetStableFrames+1:0;
          state.returnStableFrames=0;
          if(!atTarget){
            state.holdStartedAtMs=null;state.holdRemainingSec=null;state.holdComplete=false;
            state.holdAtTarget=false;state.holdInterrupted=true;
          }else{
            state.holdAtTarget=true;
            if(!Number.isFinite(state.holdStartedAtMs)){
              state.holdStartedAtMs=currentTime+config.targetFeedbackMs;
              state.holdRemainingSec=Math.ceil(state.holdDurationMs/1000);
              state.holdRestartCount+=1;
            }
            state.holdInterrupted=false;
            if(currentTime>=state.holdStartedAtMs){
              const elapsed=currentTime-state.holdStartedAtMs;
              state.holdRemainingSec=Math.max(1,
                Math.ceil((state.holdDurationMs-elapsed)/1000));
              if(elapsed>=state.holdDurationMs){
                state.holdRemainingSec=0;state.holdComplete=true;state.phase='await-return';
              }
            }
          }
        }else if(state.phase==='await-return'){
          state.targetStableFrames=0;
          state.returnStableFrames=state.estimatedAngle>=Math.max(0,state.selectedStartDeg-config.startToleranceDeg)
            && state.estimatedAngle<=state.selectedStartDeg+returnWindow
            ? state.returnStableFrames+1:0;
        }
        if(state.phase==='await-return'&&state.cycleArmed
            &&state.returnStableFrames>=config.gateStableFrames){
          state.repetitions+=1;state.cycleArmed=false;state.targetStableFrames=0;
          state.holdStartedAtMs=null;state.holdRemainingSec=null;state.holdComplete=false;
          state.holdAtTarget=false;state.holdInterrupted=false;
          state.selectedStartDeg=nextRandomStart(state.selectedStartDeg);
          state.trainingMin=state.selectedStartDeg;
          state.prescribedExcursionDeg=state.selectedTargetDeg-state.selectedStartDeg;
          state.progress=clamp01((state.estimatedAngle-state.trainingMin)/(state.trainingMax-state.trainingMin));
          state.phase='await-start'; state.startStableFrames=0; state.returnStableFrames=0;
        }
        state.gameReady=true; state.reason='ready';
      }
      return snapshot();
    }
    function snapshot() {
      return {level:state.level,phase:state.phase,reason:state.reason,calibrated:state.calibrated,
        gameReady:state.gameReady,framingReady:state.framingReady,side:state.side,newFrame:state.newFrame,
        exerciseMode:state.exerciseMode,trackingTarget:state.trackingTarget,
        unaffectedHandFallback:state.unaffectedHandFallback,
        rawAngle:state.rawAngle,worldAngle:state.worldAngle,filteredAngle:state.filteredAngle,
        estimatedAngle:state.estimatedAngle,baseline:state.baseline,maximum:state.maximum,
        observedTargetAngle:state.observedTargetAngle,prescribedExcursionDeg:state.prescribedExcursionDeg,
        selectedStartDeg:state.selectedStartDeg,selectedTargetDeg:state.selectedTargetDeg,peakEstimatedAngle:state.peakEstimatedAngle,
        targetReached:state.targetReached,repetitions:state.repetitions,
        holdDurationMs:state.holdDurationMs,holdRemainingSec:state.holdRemainingSec,
        holdComplete:state.holdComplete,holdRestartCount:state.holdRestartCount,
        holdAtTarget:state.holdAtTarget,holdInterrupted:state.holdInterrupted,
        holdFeedbackActive:state.phase==='target-hold' && state.holdAtTarget
          && Number.isFinite(state.holdStartedAtMs) && Number.isFinite(state.lastUpdateMs)
          && state.lastUpdateMs<state.holdStartedAtMs,
        holdCountdownActive:state.phase==='target-hold' && state.holdAtTarget
          && Number.isFinite(state.holdStartedAtMs) && Number.isFinite(state.lastUpdateMs)
          && state.lastUpdateMs>=state.holdStartedAtMs,
        startStableFrames:state.startStableFrames,targetStableFrames:state.targetStableFrames,
        returnStableFrames:state.returnStableFrames,
        trainingMin:state.trainingMin,trainingMax:state.trainingMax,progress:state.progress,signalSource:state.signalSource,
        startReady:state.phase!=='await-start',
        returnReady:state.returnStableFrames>=config.gateStableFrames,
        // Latch the endpoint for the current transport so a small drop during
        // target dwell does not cancel a valid reach.
        targetReady:state.cycleArmed,
        compensation:state.compensation,stableFrames:state.samples.length,requiredStableFrames:config.stableFrames,
        anchorJumpFrames:state.anchorJumpFrames,
        frame:Object.assign({},state.frame)};
    }
    function guidance() {
      if(state.reason==='frame-stale') return {main:'等待新相機畫面',en:'Waiting for a fresh camera frame'};
      if(state.reason==='selected-side-mismatch') return {main:'患側設定不一致，請重新開始',en:'Affected-side setting changed; restart'};
      if(state.reason==='selected-arm-lost') return {main:'請讓已選患側肩、肘及軀幹入鏡',en:'Show the selected affected shoulder, elbow and trunk'};
      if(state.reason==='movement-safeguard-trunk-lean') return {main:'暫停：請治療師檢查軀幹傾斜',en:'Paused: therapist check trunk lean'};
      if(state.phase==='anchor') return {main:'保持坐姿，已選患側手臂入鏡',en:'Hold sitting position with the selected affected arm visible'};
      if(state.phase==='capture-baseline') return {main:'患臂自然垂低並停住',en:'Hold the affected arm down and still'};
      if(state.phase==='await-start') return {main:'先到本回合起點 '+state.selectedStartDeg+'° 並停住',en:'First hold the '+state.selectedStartDeg+'° start'};
      if(state.phase==='target-hold' && state.holdInterrupted) return {main:'再抬高 · 保持',en:'Lift and hold again'};
      if(state.phase==='target-hold') return {main:'保持舉高',en:'Keep raised'};
      if(state.phase==='await-return') return {main:'慢慢返回 '+state.selectedStartDeg+'°',en:'Return slowly to '+state.selectedStartDeg+'°'};
      return state.level==='4'
        ? {main:'起點 '+state.selectedStartDeg+'° → 目標 '+state.selectedTargetDeg+'° → 返回',en:'Start '+state.selectedStartDeg+'° → Target '+state.selectedTargetDeg+'° → return'}
        : {main:'起點 '+state.selectedStartDeg+'° → 目標 '+state.selectedTargetDeg+'° → 返回',en:'Start '+state.selectedStartDeg+'° → Target '+state.selectedTargetDeg+'° → return'};
    }
    function toText() {
      const s=snapshot();
      return `shoulderFlexion phase:${s.phase} reason:${s.reason} ready:${s.gameReady} side:${s.side} exerciseMode:${s.exerciseMode} trackingTarget:${s.trackingTarget} unaffectedHandFallback:${s.unaffectedHandFallback} frame:${s.frame.fresh?'fresh':'stale'} gen:${s.frame.generation??'na'} source:${s.signalSource} cameraAngle:${Number.isFinite(s.rawAngle)?s.rawAngle.toFixed(1):'na'} worldDiagnostic:${Number.isFinite(s.worldAngle)?s.worldAngle.toFixed(1):'na'} selectedStart:${s.selectedStartDeg} cameraZero:${Number.isFinite(s.baseline)?s.baseline.toFixed(1):'na'} estimated:${Number.isFinite(s.estimatedAngle)?s.estimatedAngle.toFixed(1):'na'} target:${s.selectedTargetDeg} peak:${Number.isFinite(s.peakEstimatedAngle)?s.peakEstimatedAngle.toFixed(1):'na'} progress:${s.progress.toFixed(3)} targetReady:${s.targetReady} holdRemaining:${s.holdRemainingSec??'na'} repetitions:${s.repetitions} compensation:${s.compensation||'none'}`;
    }
    function setExerciseMode(mode) {
      if(!exerciseModeAvailable(state.level))return false;
      if(mode!=='active'&&mode!=='assisted-stick')return false;
      state.exerciseMode=mode;
      return true;
    }
    function setTarget(targetDeg,level){
      const value=Number(targetDeg);
      if(!Number.isFinite(value))return false;
      state.level=String(level||state.level);
      const allowed=state.level==='4'
        ? Array.from({length:13},(_,index)=>60+index*10)
        : [30,40,50,60];
      if(!allowed.includes(value))return false;
      state.selectedTargetDeg=value;
      if(!startChoices(state.level,value).includes(state.selectedStartDeg)){
        state.selectedStartDeg=nextRandomStart(state.selectedStartDeg);
      }
      if(state.calibrated){
        state.trainingMin=state.selectedStartDeg;
        state.trainingMax=value;
        state.prescribedExcursionDeg=value-state.selectedStartDeg;
        state.observedTargetAngle=state.baseline+value;
        state.progress=clamp01((state.estimatedAngle-state.trainingMin)/(value-state.trainingMin));
        state.cycleArmed=false;
        state.targetReached=false;
        state.phase='await-start';
        state.startStableFrames=0;
        state.targetStableFrames=0;
        state.returnStableFrames=0;
      }
      return true;
    }
    function setHoldDuration(seconds){
      const value=Number(seconds);
      if(![0,1,2,3,4,5].includes(value))return false;
      state.holdDurationMs=value*1000;
      state.holdStartedAtMs=null;state.holdRemainingSec=null;state.holdComplete=false;
      state.holdAtTarget=false;state.holdInterrupted=false;
      return true;
    }
    return {config,state,reset,setTarget,setHoldDuration,setExerciseMode,startChoices,update,snapshot,guidance,toText};
  }

  const api={CONFIG,createController,exerciseModeAvailable,selectedArm,shoulderFlexion2D,shoulderFlexionWorld,torsoSignature,clamp01,median};
  global.ShoulderFlexionController=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
