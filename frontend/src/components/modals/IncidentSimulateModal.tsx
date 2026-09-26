import React, { useState, useEffect } from 'react';
import { Corridor } from '../../types';
import api from '../../api/client';
import { FALLBACK_CORRIDORS } from '../../api/fallbackData';
import { AlertOctagon, X, Zap, Radio, Hammer, Train, Send } from 'lucide-react';

interface IncidentSimulateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (eventData?: any) => void;
}

export const IncidentSimulateModal: React.FC<IncidentSimulateModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [corridors, setCorridors] = useState<Corridor[]>(FALLBACK_CORRIDORS);
  const [corridorId, setCorridorId] = useState<number>(1);
  const [eventType, setEventType] = useState('SIGNAL_FAILURE');
  const [title, setTitle] = useState('Critical Signal Point Machine S-102 Jammed');
  const [description, setDescription] = useState('Point machine 102 failed to detect normal position. Train 12951 Rajdhani held at home signal.');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get<Corridor[]>('/master/corridors?limit=30')
        .then(res => {
          if (res.data && res.data.length > 0) {
            setCorridors(res.data);
            setCorridorId(res.data[0].id);
          }
        })
        .catch(() => {
          setCorridors(FALLBACK_CORRIDORS);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const presets = [
    {
      type: 'SIGNAL_FAILURE',
      title: 'Signal Point Machine S-102 Jammed',
      desc: 'Point machine 102 failed to detect normal position. Train 12951 Rajdhani held at home signal.'
    },
    {
      type: 'OHE_BREAKDOWN',
      title: 'OHE Catenary Wire Dropper Snapped',
      desc: 'Overhead traction catenary wire hanging dangerously close to track bed on Up line.'
    },
    {
      type: 'RAIL_FRACTURE',
      title: 'USFD Ultrasonic Confirmed Rail Fracture',
      desc: 'Transverse fissure detected at Km 342/18. Maximum permissible speed restricted to 20 km/h.'
    },
    {
      type: 'TRAIN_DELAY',
      title: 'Express Train 12009 Shatabdi Delayed by 40 Mins',
      desc: 'Upstream locomotive fault shifted passenger train window into planned night maintenance slot.'
    }
  ];

  const handlePreset = (p: typeof presets[0]) => {
    setEventType(p.type);
    setTitle(p.title);
    setDescription(p.desc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/live/simulate', {
        corridor_id: corridorId,
        event_type: eventType,
        title,
        description
      });
      onSuccess(res.data);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to simulate live incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-red-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-200" />
            <h3 className="font-bold text-base">Inject Live Operational Anomaly / Emergency</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-red-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-600 leading-relaxed">
            Test the <strong>Dynamic AI Re-planning Engine</strong> by simulating an unexpected track failure or train delay during active operations.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Quick Scenario Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => handlePreset(p)}
                  className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                    eventType === p.type
                      ? 'border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="block font-bold">{p.type.replace('_', ' ')}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{p.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Corridor Affected *
            </label>
            <select
              value={corridorId}
              onChange={(e) => setCorridorId(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              {corridors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} ({c.name}) - {c.track_type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Incident Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Incident Description & Rail Traffic Impact *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition flex items-center gap-2"
            >
              {submitting ? 'Injecting Anomaly...' : 'Trigger Incident & Run Dynamic Re-planning'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
