(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.Level2HorizontalAbductionController=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEFAULTS=Object.freeze({
    minVisibility:.35,
    baselineFrames:5,
    outwardSpan:.72,
    targetThreshold:.84,
    returnThreshold:.16,
    endpointFrames:2,
    maxTorsoTranslation:.14,
    maxTorsoLean:.24,
    baselineMidlineTolerance:.10,
    smoothing:.42,
  });

  const finite=n=>Number.isFinite(Number(n));
  const clamp01=n=>Math.max(0,Math.min(1,n));
  const median=values=>{
    const sorted=values.slice().sort((a,b)=>a-b);
    const middle=Math.floor(sorted.length/2);
    return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
  };
  function usable(point,minVisibility){
    if(!point||!finite(point.x)||!finite(point.y)) return false;
    if(finite(point.visibility)&&Number(point.visibility)<minVisibility) return false;
    if(finite(point.presence)&&Number(point.presence)<minVisibility) return false;
    return true;
  }
  function selectedIndices(side){
    return side==='left'
      ? {shoulder:11,elbow:13,wrist:15}
      : {shoulder:12,elbow:14,wrist:16};
  }
  function geometry(landmarks,side,minVisibility,aspectX=1){
    const index=selectedIndices(side);
    const required={
      shoulder:landmarks?.[index.shoulder],
      elbow:landmarks?.[index.elbow],
      wrist:landmarks?.[index.wrist],
      leftShoulder:landmarks?.[11],
      rightShoulder:landmarks?.[12],
      leftHip:landmarks?.[23],
      rightHip:landmarks?.[24],
    };
    for(const [name,point] of Object.entries(required)){
      if(!usable(point,minVisibility)) return {valid:false,reason:'missing-'+name};
    }
    const corrected=Object.fromEntries(Object.entries(required).map(([name,point])=>[
      name,{x:Number(point.x)*(finite(aspectX)&&Number(aspectX)>0?Number(aspectX):1),y:Number(point.y)}
    ]));
    const shoulderCentre={
      x:(corrected.leftShoulder.x+corrected.rightShoulder.x)/2,
      y:(corrected.leftShoulder.y+corrected.rightShoulder.y)/2,
    };
    const hipCentre={
      x:(corrected.leftHip.x+corrected.rightHip.x)/2,
      y:(corrected.leftHip.y+corrected.rightHip.y)/2,
    };
    const dx=corrected.shoulder.x-shoulderCentre.x;
    const dy=corrected.shoulder.y-shoulderCentre.y;
    const halfSpan=Math.hypot(dx,dy);
    const shoulderSpan=halfSpan*2;
    if(!finite(shoulderSpan)||shoulderSpan<.04) return {valid:false,reason:'invalid-torso-reference'};
    const outward={x:dx/halfSpan,y:dy/halfSpan};
    const project=point=>((point.x-shoulderCentre.x)*outward.x+
      (point.y-shoulderCentre.y)*outward.y)/shoulderSpan;
    return {
      valid:true,
      shoulderCentre,
      hipCentre,
      shoulderSpan,
      outward,
      wrist:project(corrected.wrist),
      elbow:project(corrected.elbow),
      torsoLean:((shoulderCentre.x-hipCentre.x)*outward.x+
        (shoulderCentre.y-hipCentre.y)*outward.y)/shoulderSpan,
    };
  }

  function createController(options={}){
    const config={...DEFAULTS,...options};
    let state;
    function reset(){
      state={
        calibrated:false,
        phase:'outward',
        progress:0,
        instantProgress:0,
        targetHits:0,
        targetFrames:0,
        returnFrames:0,
        newFrame:false,
        valid:false,
        reason:'awaiting-midline',
        lastGeneration:null,
        baselineSamples:[],
        baseline:null,
        frame:{fresh:false,generation:null},
      };
      return snapshot();
    }
    function snapshot(){
      return {
        ...state,
        baselineSamples:state.baselineSamples.slice(),
        baseline:state.baseline?{...state.baseline,centre:{...state.baseline.centre}}:null,
        frame:{...state.frame},
      };
    }
    function reject(reason,generation){
      state.newFrame=true;
      state.valid=false;
      state.reason=reason;
      state.targetFrames=0;
      state.returnFrames=0;
      state.frame={fresh:true,generation};
      return snapshot();
    }
    function update(packet={}){
      const generation=Number(packet.generation);
      state.newFrame=false;
      state.frame={fresh:false,generation:finite(generation)?generation:null};
      if(!finite(generation)) return reject('missing-generation',null);
      if(state.lastGeneration!==null&&generation<=state.lastGeneration){
        state.valid=false;
        state.reason=generation===state.lastGeneration?'duplicate-generation':'out-of-order-generation';
        return snapshot();
      }
      state.lastGeneration=generation;
      const side=packet.affectedSide==='left'?'left':'right';
      const pose=geometry(packet.landmarks,side,config.minVisibility,packet.aspectX);
      if(!pose.valid) return reject(pose.reason,generation);
      if(!state.calibrated){
        if(Math.abs(pose.wrist)>config.baselineMidlineTolerance){
          state.baselineSamples=[];
          return reject('not-at-midline',generation);
        }
        state.baselineSamples.push(pose);
        if(state.baselineSamples.length>=config.baselineFrames){
          state.baseline={
            wrist:median(state.baselineSamples.map(sample=>sample.wrist)),
            elbow:median(state.baselineSamples.map(sample=>sample.elbow)),
            lean:median(state.baselineSamples.map(sample=>sample.torsoLean)),
            span:median(state.baselineSamples.map(sample=>sample.shoulderSpan)),
            centre:{
              x:median(state.baselineSamples.map(sample=>sample.shoulderCentre.x)),
              y:median(state.baselineSamples.map(sample=>sample.shoulderCentre.y)),
            },
          };
          state.calibrated=true;
          state.reason='ready';
        }else{
          state.reason='hold-at-midline';
        }
        state.valid=true;
        state.newFrame=true;
        state.frame={fresh:true,generation};
        return snapshot();
      }
      const centreShift=Math.hypot(
        pose.shoulderCentre.x-state.baseline.centre.x,
        pose.shoulderCentre.y-state.baseline.centre.y
      )/state.baseline.span;
      if(centreShift>config.maxTorsoTranslation) return reject('torso-translation',generation);
      if(Math.abs(pose.torsoLean-state.baseline.lean)>config.maxTorsoLean){
        return reject('torso-lean',generation);
      }
      const wristDelta=pose.wrist-state.baseline.wrist;
      state.instantProgress=clamp01(wristDelta/config.outwardSpan);
      state.progress+=config.smoothing*(state.instantProgress-state.progress);
      state.valid=true;
      state.newFrame=true;
      state.reason='tracking';
      state.frame={fresh:true,generation};
      if(state.phase==='outward'){
        state.returnFrames=0;
        state.targetFrames=state.progress>=config.targetThreshold?state.targetFrames+1:0;
        if(state.targetFrames>=config.endpointFrames){
          state.targetFrames=0;
          state.phase='return';
          state.targetHits+=1;
        }
      }else{
        state.targetFrames=0;
        state.returnFrames=state.progress<=config.returnThreshold?state.returnFrames+1:0;
        if(state.returnFrames>=config.endpointFrames){
          state.returnFrames=0;
          state.phase='outward';
        }
      }
      return snapshot();
    }
    reset();
    return {reset,update,snapshot};
  }

  return {createController,geometry,DEFAULTS};
});
