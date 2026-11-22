/* Project B UsageU2.gs migration candidate: COPY-SHEET SHADOW ONLY.
 * This is a new parallel method, NOT a replacement for live
 * getUsageStatisticsU2(creatorToken), which remains unchanged.
 *
 * Include (isolated test GAS only):
 * - existing Project B UsageU2.gs authorization functions from current source,
 * - HOJA_USAGE_SUMMARY_READ_V1.js
 * - HOJA_USAGE_SUMMARY_READ_TRIAL_GAS.gs
 * - HOJA_PROJECT_B_USAGE_SHADOW_V1.js
 *
 * Requires HOJA_USAGE_TRIAL_SPREADSHEET_ID pointing to a distinct sheet COPY,
 * existing _HOJA_USAGE_TRIAL_ONLY canary, and no deployed production changes.
 * No raw EVENT_LOG read, writes, ranking access, triggers or external network.
 */
function getUsageStatisticsU3ShadowTrial(creatorToken,dateKeys,asOf){
  // Crucial: do NOT duplicate or relax Project B's existing OWNER/current
  // GOOGLE CREATOR authorization. In particular, EDIT_CODE-only/revoked
  // creators and missing/expired sessions must not see even aggregated stats.
  const access=requireUsageStatisticsAccessU3_(creatorToken);
  if(!access||!['OWNER','CREATOR'].includes(access.role))
    throw Error('HOJA_PROJECT_B_SHADOW_ACCESS_DENIED');
  if(typeof HOJA_PROJECT_B_USAGE_SHADOW_V1==='undefined')
    throw Error('HOJA_PROJECT_B_SHADOW_PROJECTOR_MISSING');
  const report=hojaUsageSummaryReadTrialU1(dateKeys);
  return HOJA_PROJECT_B_USAGE_SHADOW_V1.project(report,{
    accessRole:access.role,asOf
  });
}
