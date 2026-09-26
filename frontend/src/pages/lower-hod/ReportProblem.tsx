import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Corridor, Asset } from '../../types';
import api from '../../api/client';
import { FALLBACK_CORRIDORS, getFallbackAssetsForUser } from '../../api/fallbackData';
import { BreadcrumbContext } from '../../components/layout/BreadcrumbContext';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Zap,
  Radio,
  Hammer,
  ArrowRight,
  ArrowLeft,
  Upload,
  Info,
  Database,
  RefreshCw
} from 'lucide-react';

export const ReportProblem: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [corridors, setCorridors] = useState<Corridor[]>(FALLBACK_CORRIDORS);
  const [assets, setAssets] = useState<Asset[]>(() => getFallbackAssetsForUser(user?.department_code, user?.department_id));
  const [loading, setLoading] = useState(false);
  const [isLiveSync, setIsLiveSync] = useState(false);

  // Form State
  const [corridorId, setCorridorId] = useState<number>(1);
  const [assetId, setAssetId] = useState<number>(() => {
    const initial = getFallbackAssetsForUser(user?.department_code, user?.department_id);
    return initial.length > 0 ? initial[0].id : 1;
  });
  const [assetCriticality, setAssetCriticality] = useState<string>(() => {
    const initial = getFallbackAssetsForUser(user?.department_code, user?.department_id);
    return initial.length > 0 ? initial[0].criticality : 'HIGH';
  });
  
  const [workDescription, setWorkDescription] = useState('OHE Insulator flash mark and surface glazing crack on mast 24/18.');
  const [resourcesRequired, setResourcesRequired] = useState('Tower Wagon TW-04, HV Earth rods, Torque Wrench');
  const [manpowerRequired, setManpowerRequired] = useState(6);
  const [manpowerAvailable, setManpowerAvailable] = useState(6);
  const [safetyRisk, setSafetyRisk] = useState('HIGH');
  const [isolationRequired, setIsolationRequired] = useState(true);

  const [priority, setPriority] = useState('HIGH');
  const [requestedDate, setRequestedDate] = useState('2026-09-14');
  const [requestedStartTime, setRequestedStartTime] = useState('02:00');
  const [requestedEndTime, setRequestedEndTime] = useState('04:00');
  const [maxDurationHours, setMaxDurationHours] = useState(2.0);

  const [inspectionStatus, setInspectionStatus] = useState('INSPECTED');
  const [inspectionRemarks, setInspectionRemarks] = useState('Field visual inspection confirmed tracking marks on insulator skirt. Arc flash risk in humid weather.');

  // Live AI Preview State
  const [aiPreview, setAiPreview] = useState({
    ai_priority: 'HIGH',
    ai_safety_risk: 'MEDIUM',
    ai_estimated_duration: '2.0 Hours',
    ai_train_impact: 'LOW',
    recommendation: 'Submit for multi-department Block Fusion analysis. Recommended window: 02:00–04:00 AM.'
  });

  const loadData = async () => {
    // 1. Fetch Corridors
    try {
      const cRes = await api.get<Corridor[]>('/master/corridors?limit=50');
      if (cRes.data && Array.isArray(cRes.data) && cRes.data.length > 0) {
        setCorridors(cRes.data);
        setIsLiveSync(true);
      }
    } catch {
      // Fallback corridors already initialized
    }

    // 2. Fetch Departmental Assets
    try {
      const aRes = await api.get<Asset[]>('/master/assets', {
        params: { department_id: user?.department_id, limit: 100 }
      });
      if (aRes.data && Array.isArray(aRes.data) && aRes.data.length > 0) {
        setAssets(aRes.data);
        setAssetId(aRes.data[0].id);
        setAssetCriticality(aRes.data[0].criticality);
        if (aRes.data[0].corridor_id) {
          setCorridorId(aRes.data[0].corridor_id);
        }
        setIsLiveSync(true);
      } else {
        const fbAssets = getFallbackAssetsForUser(user?.department_code, user?.department_id);
        setAssets(fbAssets);
        if (fbAssets.length > 0) {
          setAssetId(fbAssets[0].id);
          setAssetCriticality(fbAssets[0].criticality);
          if (fbAssets[0].corridor_id) {
            setCorridorId(fbAssets[0].corridor_id);
          }
        }
      }
    } catch {
      const fbAssets = getFallbackAssetsForUser(user?.department_code, user?.department_id);
      setAssets(fbAssets);
      if (fbAssets.length > 0) {
        setAssetId(fbAssets[0].id);
        setAssetCriticality(fbAssets[0].criticality);
        if (fbAssets[0].corridor_id) {
          setCorridorId(fbAssets[0].corridor_id);
        }
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.department_id, user?.department_code]);

  // Update AI preview dynamically
  useEffect(() => {
    api.post('/requests/ai-preview', {
      asset_criticality: assetCriticality,
      priority,
      isolation_required: isolationRequired,
      max_duration_hours: maxDurationHours
    }).then(res => setAiPreview(res.data)).catch(() => {});
  }, [assetCriticality, priority, isolationRequired, maxDurationHours]);

  const handleCorridorChange = (newCorrId: number) => {
    setCorridorId(newCorrId);
    const matching = assets.filter(a => a.corridor_id === newCorrId);
    if (matching.length > 0 && !matching.some(a => a.id === assetId)) {
      setAssetId(matching[0].id);
      setAssetCriticality(matching[0].criticality);
    }
  };

  const handleAssetChange = (aid: number) => {
    setAssetId(aid);
    const sel = assets.find(a => a.id === aid);
    if (sel) {
      setAssetCriticality(sel.criticality);
      if (sel.corridor_id) setCorridorId(sel.corridor_id);
    }
  };

  // Filter assets by selected corridor if matching items exist, else show all
  const corridorAssets = assets.filter(a => a.corridor_id === corridorId);
  const displayedAssets = corridorAssets.length > 0 ? corridorAssets : assets;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedCorr = corridors.find(c => c.id === corridorId);
      await api.post('/requests', {
        corridor_id: corridorId,
        from_station_id: selectedCorr?.from_station_id,
        to_station_id: selectedCorr?.to_station_id,
        asset_id: assetId,
        asset_criticality: assetCriticality,
        work_description: workDescription,
        manpower_required: manpowerRequired,
        manpower_available: manpowerAvailable,
        resources_required: resourcesRequired,
        safety_risk: safetyRisk,
        isolation_required: isolationRequired,
        priority,
        requested_date: requestedDate,
        requested_start_time: requestedStartTime,
        requested_end_time: requestedEndTime,
        max_duration_hours: maxDurationHours,
        inspection_status: inspectionStatus,
        inspection_remarks: inspectionRemarks
      });

      alert('Problem Report Created Successfully!\nWorkflow triggered: AI Analysis → Conflict Check → Higher HOD Review.');
      navigate('/lower/my-work');
    } catch (err) {
      console.error(err);
      alert('Failed to submit maintenance problem report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <BreadcrumbContext
        title="Report New Problem"
        subpath="Report an inspected maintenance problem for your department"
      />

      {/* Step Indicators */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          {[
            { num: 1, label: 'Problem Info' },
            { num: 2, label: 'Work Requirements' },
            { num: 3, label: 'Schedule' },
            { num: 4, label: 'Inspection & AI' }
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer text-center ${
                step === s.num
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : (step > s.num
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wider font-bold">Step {s.num}</span>
              <span className="text-xs truncate">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* STEP 1: Problem Information */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 1 — Problem Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Department (Auto Selected)
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.department_name || 'Electrical Department'}
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Problem ID (Auto Generated on Submit)
                </label>
                <input
                  type="text"
                  disabled
                  value="PR-2026-[AUTO]"
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono text-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {isLiveSync ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Live Railway Master Data Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <Database className="w-3 h-3 text-blue-600" />
                    Standard Corridor Infrastructure Active
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={loadData}
                className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1 transition"
                title="Refresh master data"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reload Data</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Corridor Section *
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {corridors.length} Sections Available
                </span>
              </div>
              <select
                value={corridorId}
                onChange={(e) => handleCorridorChange(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 shadow-2xs"
              >
                {corridors.length === 0 && <option value="">Loading corridors...</option>}
                {corridors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.track_type}, {c.distance_km} km)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Fixed Infrastructure Asset *
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold">
                    {displayedAssets.length} Assets in Section
                  </span>
                </div>
                <select
                  value={assetId}
                  onChange={(e) => handleAssetChange(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 shadow-2xs"
                >
                  {displayedAssets.length === 0 && <option value="">Loading departmental assets...</option>}
                  {displayedAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.asset_id}] {a.name} ({a.asset_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Asset Criticality *
                </label>
                <select
                  value={assetCriticality}
                  onChange={(e) => setAssetCriticality(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 shadow-2xs"
                >
                  <option value="CRITICAL">CRITICAL (Main Trunk Line)</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Work Requirements */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 2 — Work Requirements
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Work Description & Defect Details *
              </label>
              <textarea
                rows={3}
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe the failure, physical defect, and precise technical restoration required..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Specialized Resources & Machinery Required *
              </label>
              <input
                type="text"
                value={resourcesRequired}
                onChange={(e) => setResourcesRequired(e.target.value)}
                placeholder="e.g., Tower Wagon TW-04, Ultrasonic Detector, Tamping Machine..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Manpower Gang Required (Technicians) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={manpowerRequired}
                  onChange={(e) => setManpowerRequired(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Manpower Available in Gang *
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={manpowerAvailable}
                  onChange={(e) => setManpowerAvailable(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Safety Risk Classification *
                </label>
                <select
                  value={safetyRisk}
                  onChange={(e) => setSafetyRisk(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="HIGH">HIGH (Live Line / Adjacent Track)</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isolationRequired}
                    onChange={(e) => setIsolationRequired(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    Traction Power / OHE Isolation Required
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Schedule & Commitment */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 3 — Schedule & Operational Commitment
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department Requested Priority *
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL (Emergency)</option>
                  <option value="HIGH">HIGH (Urgent)</option>
                  <option value="MEDIUM">MEDIUM (Standard Routine)</option>
                  <option value="LOW">LOW (Periodic Overhaul)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Maintenance Date *
                </label>
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Proposed Start Time *
                </label>
                <input
                  type="text"
                  value={requestedStartTime}
                  onChange={(e) => setRequestedStartTime(e.target.value)}
                  placeholder="02:00"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Proposed End Time *
                </label>
                <input
                  type="text"
                  value={requestedEndTime}
                  onChange={(e) => setRequestedEndTime(e.target.value)}
                  placeholder="04:00"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Maximum Commitment (Hours) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="8.0"
                  value={maxDurationHours}
                  onChange={(e) => setMaxDurationHours(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
              <span>
                Maximum duration represents your department's formal commitment. In MCR verification, exceeding this window requires mandatory delay justification.
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: Inspection & AI Initial Assessment */}
        {step === 4 && (
          <div className="p-6 space-y-5">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Step 4 — Inspection & AI Initial Assessment
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Inspection Remarks *
              </label>
              <textarea
                rows={3}
                value={inspectionRemarks}
                onChange={(e) => setInspectionRemarks(e.target.value)}
                placeholder="Field inspection remarks, condition of trackbed/OHE/Signalling..."
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* Supporting Photos / Docs placeholder */}
            <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50/60">
              <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
              <p className="text-xs font-semibold text-slate-700">Supporting Inspection Documents & Photos</p>
              <p className="text-[11px] text-slate-400 mt-0.5">site_defect_photo.jpg, test_probe_reading.pdf attached (Demo)</p>
            </div>

            {/* PROMINENT AI PREVIEW CARD */}
            <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/60 to-white shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-bold text-blue-950 uppercase tracking-wider">
                  AI Initial Assessment Preview
                </h4>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Recommended Priority</span>
                  <span className="font-bold text-red-600 text-sm">{aiPreview.ai_priority}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Safety Risk</span>
                  <span className="font-bold text-amber-600 text-sm">{aiPreview.ai_safety_risk}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Estimated Duration</span>
                  <span className="font-bold text-slate-900 text-sm">{aiPreview.ai_estimated_duration}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-blue-100">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Potential Train Impact</span>
                  <span className="font-bold text-emerald-600 text-sm">{aiPreview.ai_train_impact}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{aiPreview.recommendation}</span>
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              * Note: Submission does not automatically approve the block. It enters the <strong>AI Conflict Detection</strong> and <strong>Higher HOD Review</strong> queue.
            </div>
          </div>
        )}

        {/* Step Navigation Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
          ) : <div></div>}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 rounded-lg bg-railway-dark hover:bg-railway-accent text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              {loading ? 'Submitting...' : 'Submit Problem Report'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
