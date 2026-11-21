// Provisional limits and proportional thresholds. Server authority validates them before freeze.
export function timeSettings(seconds=900,revision=1){
 if(!Number.isInteger(seconds)||seconds<300||seconds>1800||seconds%60)throw Object.assign(new Error('INVALID_DURATION'),{code:'INVALID_DURATION'});
 return {durationSeconds:seconds,sunsetThresholdSeconds:Math.round(seconds*2/9),nightThresholdSeconds:Math.round(seconds/9),questionGuideThresholdSeconds:Math.round(seconds/9),settingsRevision:revision};
}
