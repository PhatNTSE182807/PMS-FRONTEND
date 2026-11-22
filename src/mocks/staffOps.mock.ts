/**
 * Demo data for the Staff (gate attendant) console: the station header and summary numbers of the
 * gate dashboard.
 */

/* ------------------------------------------------------------------ */
/* Station                                                              */
/* ------------------------------------------------------------------ */

export const demoStation = {
  facility: 'Saigon Centre - Takashimaya',
  facilityCode: 'LOT-SGC-01',
  station: 'Gate POS 01',
  lane: 'Front entrance',
  employeeCode: 'EMP-0418',
  title: 'Senior Gate Officer',
  manager: 'Duc Nguyen',
  managerCode: 'EMP-0091',
  edgeLatencyMs: 14,
}

/* ------------------------------------------------------------------ */
/* Gate dashboard                                                       */
/* ------------------------------------------------------------------ */

export const demoGateStats = {
  activeBays: 421,
  totalBays: 500,
  generalOpen: 59,
  reservedVip: 18,
  cashInDrawer: 3_850_000,
}
