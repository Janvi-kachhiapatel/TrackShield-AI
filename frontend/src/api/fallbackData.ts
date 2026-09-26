import dbDump from '../data/databaseDump.json';
import { Corridor, Asset, Department, MaintenanceRequest, MaintenanceBlock, Station, TrainSchedule } from '../types';

export const FALLBACK_CORRIDORS: Corridor[] = (dbDump.corridors || []) as unknown as Corridor[];
export const ALL_FALLBACK_ASSETS: Asset[] = (dbDump.assets || []) as unknown as Asset[];
export const FALLBACK_DEPARTMENTS: Department[] = (dbDump.departments || []) as unknown as Department[];
export const FALLBACK_REQUESTS: MaintenanceRequest[] = (dbDump.maintenance_requests || []) as unknown as MaintenanceRequest[];
export const FALLBACK_BLOCKS: MaintenanceBlock[] = (dbDump.maintenance_blocks || []) as unknown as MaintenanceBlock[];
export const FALLBACK_STATIONS: Station[] = (dbDump.stations || []) as unknown as Station[];
export const FALLBACK_TRAINS: TrainSchedule[] = (dbDump.train_schedules || []) as unknown as TrainSchedule[];

export const getFallbackAssetsForUser = (departmentCode?: string | null, departmentId?: number | null): Asset[] => {
  let filtered = ALL_FALLBACK_ASSETS;
  
  if (departmentId && Number(departmentId) !== 6) { // 6 is 'ALL' / Higher HOD
    filtered = filtered.filter(a => Number(a.department_id) === Number(departmentId));
  } else if (departmentCode && departmentCode.toUpperCase() !== 'ALL') {
    const code = departmentCode.toUpperCase();
    filtered = filtered.filter(a => {
      const aCode = (a.corridor_code || '').toUpperCase();
      const aName = (a.name || '').toUpperCase();
      const aAssetId = (a.asset_id || '').toUpperCase();
      return aAssetId.startsWith(code) || aName.includes(code);
    });
  }

  // If department-specific filtering returned results, return them
  if (filtered.length > 0) {
    return filtered;
  }

  // If department is 1 (ELEC) or code is ELEC
  if (departmentId === 1 || departmentCode === 'ELEC') {
    return ALL_FALLBACK_ASSETS.filter(a => Number(a.department_id) === 1);
  }
  if (departmentId === 2 || departmentCode === 'SIG') {
    return ALL_FALLBACK_ASSETS.filter(a => Number(a.department_id) === 2);
  }
  if (departmentId === 3 || departmentCode === 'CIVIL') {
    return ALL_FALLBACK_ASSETS.filter(a => Number(a.department_id) === 3);
  }
  if (departmentId === 4 || departmentCode === 'TEL') {
    return ALL_FALLBACK_ASSETS.filter(a => Number(a.department_id) === 4);
  }
  if (departmentId === 5 || departmentCode === 'MECH') {
    return ALL_FALLBACK_ASSETS.filter(a => Number(a.department_id) === 5);
  }

  return ALL_FALLBACK_ASSETS;
};
