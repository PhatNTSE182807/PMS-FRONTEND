import { useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../../services/authService';
import { parkingService } from '../../services/parkingService';
import ParkingLotFormModal from './components/ParkingLotFormModal';
import ZoneFormModal from './components/ZoneFormModal';
import './AccountManagement.css';
import './ParkingManagement.css';

const formatHours = (lot) => `${lot.openTime} - ${lot.closeTime}`;

function StatusBadge({ isActive }) {
  return (
    <span className={`pm-badge ${isActive ? 'pm-badge--active' : 'pm-badge--inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

/**
 * Parking lot & zone management (F1.4) for Web Admin - master/detail layout.
 * Left: parking lots. Right: details of the selected lot and its zones.
 * Data is MOCK (parkingService) until the Backend exposes parking endpoints.
 *
 * Permissions (SRS FR-LOT-01/02): Admin creates parking lots; Admin and Manager configure zones.
 *
 * @param {{ currentUserRole?: string }} props - falls back to the role stored in the session.
 */
export default function ParkingManagement({ currentUserRole }) {
  const role = currentUserRole ?? authService.getCurrentUser()?.role;
  const canAddLot = role === 'Admin';
  const canAddZone = role === 'Admin' || role === 'Manager';

  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(true);
  const [lotsError, setLotsError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState('');

  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  // Ignore responses of outdated zone requests when the user clicks quickly between lots.
  const zoneRequestId = useRef(0);

  const selectedLot = lots.find((lot) => lot.id === selectedId) ?? null;

  const loadLots = useCallback(async () => {
    setLotsLoading(true);
    setLotsError('');
    const res = await parkingService.getParkingLots();
    if (res.success) {
      setLots(res.data);
      // Auto-select the first lot so the detail panel is never empty when data exists.
      setSelectedId((current) => current ?? res.data[0]?.id ?? null);
    } else {
      setLotsError(res.message);
    }
    setLotsLoading(false);
  }, []);

  const loadZones = useCallback(async (lotId) => {
    const requestId = ++zoneRequestId.current;
    setZonesLoading(true);
    setZonesError('');
    const res = await parkingService.getZones(lotId);
    if (requestId !== zoneRequestId.current) return;
    if (res.success) setZones(res.data);
    else {
      setZones([]);
      setZonesError(res.message);
    }
    setZonesLoading(false);
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  useEffect(() => {
    if (selectedId) loadZones(selectedId);
    else setZones([]);
  }, [selectedId, loadZones]);

  const closeLotModal = useCallback(() => {
    setLotModalOpen(false);
    setFormError('');
  }, []);

  const closeZoneModal = useCallback(() => {
    setZoneModalOpen(false);
    setFormError('');
  }, []);

  const handleCreateLot = async (form) => {
    setSubmitting(true);
    setFormError('');
    const res = await parkingService.createParkingLot(form);
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.message);
      return;
    }
    setLots((prev) => [...prev, res.data]);
    setSelectedId(res.data.id);
    setNotice(res.message);
    closeLotModal();
  };

  const handleCreateZone = async (form) => {
    setSubmitting(true);
    setFormError('');
    const res = await parkingService.createZone({ ...form, parkingLotId: selectedId });
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.message);
      return;
    }
    setZones((prev) => [...prev, res.data]);
    setNotice(res.message);
    closeZoneModal();
  };

  // Staff / User / Guest have no access to parking configuration.
  if (!canAddZone) {
    return (
      <section className="acc-page">
        <h1 className="acc-title">Parking Management</h1>
        <div className="acc-state" role="alert">You do not have permission to manage parking lots.</div>
      </section>
    );
  }

  return (
    <section className="acc-page pm-page">
      <header className="acc-header">
        <div>
          <h1 className="acc-title">Parking Management</h1>
          <p className="acc-subtitle">Manage parking lots and the zones inside each lot.</p>
        </div>
      </header>

      {notice && (
        <div className="auth-alert auth-alert--success" role="status">
          <span>{notice}</span>
          <button type="button" className="acc-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">✕</button>
        </div>
      )}

      {lotsError && (
        <div className="auth-alert auth-alert--error" role="alert">
          <span>{lotsError}</span>
          <button type="button" className="btn btn-outline-cyan btn-sm" onClick={loadLots}>Retry</button>
        </div>
      )}

      <div className="pm-layout">
        {/* ---------- Master: parking lots ---------- */}
        <aside className="pm-panel pm-master" aria-label="Parking lots">
          <div className="pm-panel__head">
            <h2 className="pm-panel__title">
              Parking lots<span className="pm-count">({lots.length})</span>
            </h2>
            {canAddLot && (
              <button
                type="button"
                id="btn-add-lot"
                className="btn btn-primary-cyan btn-sm"
                onClick={() => setLotModalOpen(true)}
              >
                + Add new parking lot
              </button>
            )}
          </div>

          {lotsLoading ? (
            <div className="acc-state" role="status">Loading parking lots...</div>
          ) : lots.length === 0 ? (
            <div className="acc-state">No parking lots yet.</div>
          ) : (
            <ul className="pm-lot-list">
              {lots.map((lot) => (
                <li key={lot.id}>
                  <button
                    type="button"
                    className={`pm-lot-item${lot.id === selectedId ? ' pm-lot-item--active' : ''}`}
                    aria-current={lot.id === selectedId ? 'true' : undefined}
                    onClick={() => setSelectedId(lot.id)}
                  >
                    <div className="pm-lot-item__top">
                      <span className="pm-lot-item__name">{lot.name}</span>
                      <StatusBadge isActive={lot.isActive} />
                    </div>
                    <div className="pm-lot-item__meta">
                      {lot.capacity} slots · {formatHours(lot)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ---------- Detail: selected lot + zones ---------- */}
        <div className="pm-detail">
          {!selectedLot ? (
            <div className="acc-state pm-empty-detail">
              {lotsLoading ? 'Loading...' : 'Select a parking lot on the left to see its details.'}
            </div>
          ) : (
            <>
              <section className="pm-panel" aria-label="Parking lot details">
                <div className="pm-panel__head">
                  <h2 className="pm-panel__title">{selectedLot.name}</h2>
                  <StatusBadge isActive={selectedLot.isActive} />
                </div>
                <div className="pm-info-grid">
                  <div className="pm-info pm-info--wide">
                    <div className="pm-info__label">Address</div>
                    <div className="pm-info__value">{selectedLot.address}</div>
                  </div>
                  <div className="pm-info">
                    <div className="pm-info__label">Capacity</div>
                    <div className="pm-info__value">{selectedLot.capacity} slots</div>
                  </div>
                  <div className="pm-info">
                    <div className="pm-info__label">Operating hours</div>
                    <div className="pm-info__value">{formatHours(selectedLot)}</div>
                  </div>
                  <div className="pm-info">
                    <div className="pm-info__label">Zones</div>
                    <div className="pm-info__value">{zonesLoading ? '...' : zones.length}</div>
                  </div>
                </div>
              </section>

              <section className="pm-panel pm-zones" aria-label="Zones">
                <div className="pm-panel__head">
                  <h2 className="pm-panel__title">
                    Zones<span className="pm-count">({zonesLoading ? '...' : zones.length})</span>
                  </h2>
                  <button
                    type="button"
                    id="btn-add-zone"
                    className="btn btn-primary-cyan btn-sm"
                    onClick={() => setZoneModalOpen(true)}
                  >
                    + Add new zone
                  </button>
                </div>

                {zonesError && (
                  <div className="auth-alert auth-alert--error" role="alert">
                    <span>{zonesError}</span>
                    <button type="button" className="btn btn-outline-cyan btn-sm" onClick={() => loadZones(selectedId)}>
                      Retry
                    </button>
                  </div>
                )}

                {zonesLoading ? (
                  <div className="acc-state" role="status">Loading zones...</div>
                ) : zones.length === 0 && !zonesError ? (
                  <div className="acc-state">This parking lot has no zones yet.</div>
                ) : (
                  zones.length > 0 && (
                    <div className="acc-table-wrap">
                      <table className="acc-table">
                        <thead>
                          <tr>
                            <th>Zone name</th>
                            <th>Vehicle type</th>
                            <th>ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {zones.map((zone) => (
                            <tr key={zone.id}>
                              <td><span className="acc-name">{zone.name}</span></td>
                              <td>
                                <span className={`pm-badge pm-badge--${zone.type.toLowerCase()}`}>{zone.type}</span>
                              </td>
                              <td><span className="acc-sub">{zone.id}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {lotModalOpen && (
        <ParkingLotFormModal
          submitting={submitting}
          serverError={formError}
          onSubmit={handleCreateLot}
          onClose={closeLotModal}
        />
      )}

      {zoneModalOpen && selectedLot && (
        <ZoneFormModal
          lotName={selectedLot.name}
          submitting={submitting}
          serverError={formError}
          onSubmit={handleCreateZone}
          onClose={closeZoneModal}
        />
      )}
    </section>
  );
}
