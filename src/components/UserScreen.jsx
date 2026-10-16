import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import ParkingLogo from './ParkingLogo';
import { getErrorMessage } from '../api/apiError';
import { roleLabel } from '../hooks/useAuth';
import {
  useAddVehicle,
  useChangePassword,
  useDeleteVehicle,
  useProfile,
  useSetDefaultVehicle,
  useUpdateProfile,
  useUpdateVehicle,
  useVehicles,
  useVehicleTypes,
} from '../hooks/useProfile';

const CheckInQrMark = memo(function CheckInQrMark({ size = 110, onClick }) {
  return (
    <div
      className="qr-code-box"
      onClick={onClick}
      title="Click to enlarge QR Code"
    >
      <svg width={size} height={size} viewBox="0 0 110 110" fill="none">
        <rect width="110" height="110" rx="8" fill="#FFFFFF" />
        <rect x="12" y="12" width="28" height="28" fill="#000" />
        <rect x="16" y="16" width="20" height="20" fill="#FFFFFF" />
        <rect x="20" y="20" width="12" height="12" fill="#000" />
        <rect x="70" y="12" width="28" height="28" fill="#000" />
        <rect x="74" y="16" width="20" height="20" fill="#FFFFFF" />
        <rect x="78" y="20" width="12" height="12" fill="#000" />
        <rect x="12" y="70" width="28" height="28" fill="#000" />
        <rect x="16" y="74" width="20" height="20" fill="#FFFFFF" />
        <rect x="20" y="78" width="12" height="12" fill="#000" />
        <rect x="46" y="14" width="6" height="6" fill="#000" />
        <rect x="56" y="14" width="6" height="6" fill="#000" />
        <rect x="46" y="26" width="6" height="6" fill="#000" />
        <rect x="56" y="32" width="6" height="6" fill="#000" />
        <rect x="46" y="46" width="18" height="18" fill="#E98074" rx="2" />
        <rect x="14" y="46" width="6" height="6" fill="#000" />
        <rect x="26" y="46" width="6" height="6" fill="#000" />
        <rect x="34" y="56" width="6" height="6" fill="#000" />
        <rect x="72" y="48" width="6" height="6" fill="#000" />
        <rect x="84" y="56" width="6" height="6" fill="#000" />
        <rect x="52" y="74" width="6" height="6" fill="#000" />
        <rect x="64" y="74" width="6" height="6" fill="#000" />
        <rect x="52" y="86" width="6" height="6" fill="#000" />
        <rect x="80" y="80" width="6" height="6" fill="#000" />
        <rect x="88" y="90" width="6" height="6" fill="#000" />
      </svg>
    </div>
  );
});

function LiveParkingMetrics() {
  const [parkingSeconds, setParkingSeconds] = useState(6300);

  useEffect(() => {
    const timer = setInterval(() => {
      setParkingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(parkingSeconds / 3600);
  const minutes = Math.floor((parkingSeconds % 3600) / 60);
  const seconds = parkingSeconds % 60;
  const timeLabel = `${hours}h ${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;
  const rawFee = 30000 + Math.floor((parkingSeconds / 3600) * 14285);
  const feeLabel = `${(Math.round(rawFee / 1000) * 1000).toLocaleString('en-US')} VND`;

  return (
    <>
      <div className="active-metric-row">
        <span className="active-metric-label">Time:</span>
        <span className="active-metric-value">{timeLabel}</span>
      </div>
      <div className="active-metric-row">
        <span className="active-metric-label">Current Fee:</span>
        <span className="active-metric-value active-metric-value--fee">{feeLabel}</span>
      </div>
      <div className="active-metric-subtext">(updating in real-time)</div>
    </>
  );
}

const ActiveParkingCard = memo(function ActiveParkingCard({ onPayNow, onQrZoom }) {
  return (
    <div className="active-parking-card">
      <div className="active-parking-card__header">
        <h3>Active Parking - P5 (Level 2)</h3>
      </div>
      <div className="active-parking-card__body">
        <LiveParkingMetrics />
        <div className="qr-code-section">
          <div className="qr-code-label">QR Check-in Code</div>
          <CheckInQrMark onClick={onQrZoom} />
        </div>
        <button
          type="button"
          className="btn btn-primary-cyan btn-full btn-pay-now"
          onClick={onPayNow}
        >
          Pay Now
        </button>
      </div>
    </div>
  );
});

// Shown until the vehicle-types catalog has loaded (or if it fails).
const FALLBACK_VEHICLE_TYPES = [
  { id: 1, name: 'Sedan / Hatchback (Car)', code: 'CAR' },
  { id: 2, name: 'SUV / Crossover / 7-Seater', code: 'SUV' },
  { id: 3, name: 'Motorbike / Scooter', code: 'MOTO' },
  { id: 4, name: 'Electric Vehicle (EV)', code: 'EV' },
];

// Maps a VehicleDTO to the shape the vehicle cards render.
const toVehicleView = (v) => ({
  id: v.vehicleId,
  vehicleId: v.vehicleId,
  brand: v.brand || 'Vehicle',
  model: v.model || '',
  plate: v.licensePlate || '',
  licensePlate: v.licensePlate || '',
  color: v.color || 'Black',
  vehicleTypeId: v.vehicleTypeId || 1,
  vehicleType: v.vehicleType || 'Car',
  isDefault: Boolean(v.isDefault),
  isActive: v.isActive !== false,
});

// Session user enriched with the live profile (profile fields win when present).
const withProfile = (user, profile) => {
  if (!profile) return user;
  const defined = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== null && value !== undefined && value !== ''));
  return { ...user, ...defined };
};

export default function UserScreen({ user, onLogout }) {
  // Navigation tabs: 'map' | 'reservations' | 'vehicles' | 'profile'
  const [activeTab, setActiveTab] = useState('map');

  const [isCentered, setIsCentered] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Quick Reservation inputs
  const [selectedLocation, setSelectedLocation] = useState('Level 2 - Zone P5');
  const [reservationDateTime, setReservationDateTime] = useState('');
  const [reservationFeedback, setReservationFeedback] = useState('');

  // Modals state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isQrZoomOpen, setIsQrZoomOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeSubModal, setActiveSubModal] = useState(null); // 'reservations' | 'vehicles' | 'profile'

  // Notification list
  const [notifications] = useState([
    { id: 1, title: 'Check-in Recorded', desc: 'Vehicle 30E-123.45 entered Zone P5', time: '1h 45m ago', read: false },
    { id: 2, title: 'Live Rate Alert', desc: 'Standard daytime rate: 30,000 VND / hour', time: '2h ago', read: true },
  ]);

  // Reservations list
  const [reservations] = useState([
    { id: 'res-101', slot: 'P5 (Level 2)', time: 'Today, 18:30', status: 'Active', fee: '55,000 VND' },
    { id: 'res-102', slot: 'A12 (Level 1)', time: 'Tomorrow, 09:00', status: 'Upcoming', fee: 'Est. 40,000 VND' },
  ]);

  // Stable callbacks for ActiveParkingTimer
  const handlePayNow = useCallback(() => setIsPayModalOpen(true), []);
  const handleQrZoom = useCallback(() => setIsQrZoomOpen(true), []);

  // Center on my vehicle effect
  const handleCenterOnVehicle = () => {
    setIsCentered(true);
    setSelectedSlot({ id: 'P5', level: 'Level 2', status: 'my-vehicle', fee: '55,000 VND' });
    setTimeout(() => setIsCentered(false), 2500);
  };

  // Handle Find Slots
  const handleFindSlots = () => {
    setReservationFeedback(`Found 8 available slots at ${selectedLocation}! Select a slot below to confirm.`);
  };

  // Live profile & vehicles (React Query; demo sessions are served from mock data)
  const { data: profile } = useProfile();
  const currentUserProfile = useMemo(() => withProfile(user, profile), [user, profile]);

  const { data: vehicleDtos } = useVehicles();
  const vehicles = useMemo(() => (vehicleDtos ?? []).map(toVehicleView), [vehicleDtos]);

  const { data: vehicleTypesData } = useVehicleTypes();
  const vehicleTypes = vehicleTypesData?.length ? vehicleTypesData : FALLBACK_VEHICLE_TYPES;

  const addVehicle = useAddVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const setDefaultVehicle = useSetDefaultVehicle();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  // Vehicle Add / Edit Modal state
  const [vehicleModalMode, setVehicleModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedVehicleForEdit, setSelectedVehicleForEdit] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    brand: 'Toyota',
    model: 'Camry',
    licensePlate: '',
    color: 'White',
    vehicleTypeId: 1,
    isDefault: false,
  });
  const [vehicleModalError, setVehicleModalError] = useState('');
  const vehicleModalLoading = addVehicle.isPending || updateVehicle.isPending;

  // Edit Profile Modal state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    avatarUrl: '',
  });
  const [profileFeedback, setProfileFeedback] = useState({ type: '', text: '' });
  const isProfileUpdating = updateProfile.isPending;

  // Change Password Modal state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordVisibility, setShowPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordFeedback, setPasswordFeedback] = useState({ type: '', text: '' });
  const isPasswordChanging = changePassword.isPending;

  // Open Add Vehicle Modal
  const openAddVehicleModal = () => {
    setVehicleModalMode('add');
    setSelectedVehicleForEdit(null);
    setVehicleFormData({
      brand: 'Toyota',
      model: 'Camry',
      licensePlate: '',
      color: 'White',
      vehicleTypeId: vehicleTypes[0]?.id || 1,
      isDefault: vehicles.length === 0,
    });
    setVehicleModalError('');
    setIsAddVehicleModalOpen(true);
  };

  // Open Edit Vehicle Modal
  const openEditVehicleModal = (veh) => {
    setVehicleModalMode('edit');
    setSelectedVehicleForEdit(veh);
    setVehicleFormData({
      brand: veh.brand || '',
      model: veh.model || '',
      licensePlate: veh.licensePlate || veh.plate || '',
      color: veh.color || 'Black',
      vehicleTypeId: veh.vehicleTypeId || 1,
      isDefault: Boolean(veh.isDefault),
    });
    setVehicleModalError('');
    setIsAddVehicleModalOpen(true);
  };

  // Save Vehicle (POST or PUT)
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleFormData.licensePlate.trim()) {
      setVehicleModalError('Please enter license plate number.');
      return;
    }
    setVehicleModalError('');

    const command = {
      licensePlate: vehicleFormData.licensePlate.trim(),
      vehicleTypeId: Number(vehicleFormData.vehicleTypeId) || 1,
      brand: vehicleFormData.brand?.trim(),
      model: vehicleFormData.model?.trim(),
      color: vehicleFormData.color?.trim() || 'Black',
      isDefault: Boolean(vehicleFormData.isDefault),
    };

    try {
      if (vehicleModalMode === 'add') {
        await addVehicle.mutateAsync(command);
      } else {
        await updateVehicle.mutateAsync({
          vehicleId: selectedVehicleForEdit.vehicleId,
          command: { ...command, isActive: selectedVehicleForEdit.isActive !== false },
        });
      }
      setIsAddVehicleModalOpen(false);
    } catch (error) {
      setVehicleModalError(getErrorMessage(error, 'Failed to save vehicle.'));
    }
  };

  // Delete Vehicle (DELETE)
  const handleDeleteVehicle = (veh) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${veh.plate || veh.licensePlate}?`)) return;
    deleteVehicle.mutate(veh.vehicleId, {
      onError: (error) => window.alert(getErrorMessage(error, 'Failed to delete vehicle.')),
    });
  };

  // Set Default Vehicle (PATCH)
  const handleSetDefaultVehicle = (veh) => {
    setDefaultVehicle.mutate(veh.vehicleId, {
      onError: (error) => window.alert(getErrorMessage(error, 'Failed to set default vehicle.')),
    });
  };

  // Edit Profile
  const openEditProfile = () => {
    setProfileFormData({
      fullName: currentUserProfile?.fullName || '',
      email: currentUserProfile?.email || '',
      phoneNumber: currentUserProfile?.phoneNumber || '',
      avatarUrl: currentUserProfile?.avatarUrl || '',
    });
    setProfileFeedback({ type: '', text: '' });
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setProfileFeedback({ type: '', text: '' });

    updateProfile.mutate(
      {
        fullName: profileFormData.fullName?.trim(),
        email: profileFormData.email?.trim(),
        phoneNumber: profileFormData.phoneNumber?.trim(),
        avatarUrl: profileFormData.avatarUrl || '',
      },
      {
        onSuccess: () => {
          setProfileFeedback({ type: 'success', text: 'Profile updated successfully!' });
          setTimeout(() => {
            setIsEditProfileOpen(false);
            setProfileFeedback({ type: '', text: '' });
          }, 1200);
        },
        onError: (error) => {
          setProfileFeedback({ type: 'error', text: getErrorMessage(error, 'Failed to update profile.') });
        },
      },
    );
  };

  // Change Password
  const openChangePassword = () => {
    setPasswordFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordFeedback({ type: '', text: '' });
    setIsChangePasswordOpen(true);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (passwordFormData.newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPasswordFeedback({ type: '', text: '' });

    changePassword.mutate(passwordFormData, {
      onSuccess: () => {
        setPasswordFeedback({ type: 'success', text: 'Password changed successfully!' });
        setTimeout(() => {
          setIsChangePasswordOpen(false);
          setPasswordFeedback({ type: '', text: '' });
        }, 1500);
      },
      onError: (error) => {
        setPasswordFeedback({
          type: 'error',
          text: getErrorMessage(error, 'Failed to change password. Please verify your current password.'),
        });
      },
    });
  };

  // Handle Bottom Nav click
  const handleNavClick = (tabKey) => {
    setActiveTab(tabKey);
    if (tabKey !== 'map') {
      setActiveSubModal(tabKey);
    } else {
      setActiveSubModal(null);
    }
  };

  return (
    <div className="user-screen-container">
      {/* Top Application Bar */}
      <header className="user-top-bar">
        {/* Left: User Avatar */}
        <div className="user-top-bar__left">
          <div
            className="user-avatar-pill"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            title="Click for profile options"
          >
            <div className="user-avatar-img-wrap">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="User Avatar"
                className="user-avatar-img"
              />
              <span className="online-indicator"></span>
            </div>
            <div className="user-avatar-meta">
              <span className="user-avatar-name">{currentUserProfile?.fullName || currentUserProfile?.username || user?.fullName || 'Alex Rivers'}</span>
              <span className="user-avatar-role">{roleLabel(currentUserProfile?.role)}</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* User dropdown menu */}
          {isUserMenuOpen && (
            <div className="user-dropdown-menu">
              <div className="user-dropdown-header">
                <strong>{currentUserProfile?.fullName || user?.fullName || 'Alex Rivers'}</strong>
                <span>{currentUserProfile?.email || user?.email || 'alex.rivers@xxivparking.vn'}</span>
              </div>
              <button
                type="button"
                className="user-dropdown-item"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setActiveSubModal('profile');
                }}
              >
                Account Profile
              </button>
              <button
                type="button"
                className="user-dropdown-item"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  setActiveSubModal('vehicles');
                }}
              >
                My Vehicles
              </button>
              <button
                type="button"
                className="user-dropdown-item user-dropdown-item--logout"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Center: XXIV Parking logo */}
        <div className="user-top-bar__center">
          <ParkingLogo size="medium" />
        </div>

        {/* Right: Profile, Notification Bell, Logout button */}
        <div className="user-top-bar__right">
          <button
            type="button"
            className="top-action-btn"
            onClick={() => setActiveSubModal('profile')}
            title="User Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          <div className="notifications-wrapper">
            <button
              type="button"
              className="top-action-btn"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="bell-red-badge"></span>
            </button>

            {isNotificationsOpen && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h4>Notifications</h4>
                  <span className="notif-count">2 New</span>
                </div>
                <div className="notifications-list">
                  {notifications.map((n) => (
                    <div key={n.id} className="notification-card">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-desc">{n.desc}</div>
                      <div className="notif-time">{n.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Explicit Logout Button */}
          <button
            type="button"
            className="top-action-btn top-action-btn--logout"
            onClick={onLogout}
            title="Log out of XXIV Parking"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Isometric Parking Map & Widget Stage */}
      <main className="user-dashboard-stage">
        {/* Ambient Map Blueprint Grid Background */}
        <div className="stage-blueprint-bg"></div>

        {/* 3D Isometric Interactive Parking Lot */}
        <div className="isometric-map-wrapper">
          <svg
            className={`isometric-svg ${isCentered ? 'isometric-svg--pulsing' : ''}`}
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="parking-ground-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F6F2EA" />
                <stop offset="100%" stopColor="#E4DCCB" />
              </linearGradient>

              {/* Slot gradients */}
              <linearGradient id="slot-green" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4F8A5B" />
                <stop offset="100%" stopColor="#6FA67A" />
              </linearGradient>

              <linearGradient id="slot-yellow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C28A2C" />
                <stop offset="100%" stopColor="#D8A55A" />
              </linearGradient>

              <linearGradient id="slot-blue" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E85A4F" />
                <stop offset="100%" stopColor="#E98074" />
              </linearGradient>

            </defs>

            {/* Isometric Ground Baseplate */}
            <polygon
              points="500,60 920,240 500,520 80,340"
              fill="url(#parking-ground-grad)"
              stroke="#D8C3A5"
              strokeWidth="2.5"
            />

            {/* Inner Border Lane */}
            <polygon
              points="500,80 890,245 500,495 110,335"
              fill="none"
              stroke="#C9B497"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />

            {/* PARKING LOT ROWS (Isometric projections) */}
            {/* Top Row: Green Available Slots */}
            <g className="slot-row" transform="translate(0, 0)">
              {/* Slot 1 (Green) */}
              <polygon
                points="400,160 480,125 530,147 450,182"
                fill="url(#slot-green)"
                opacity="0.9"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'P1', status: 'Available', fee: '30,000 VND/h' })}
              />
              {/* Slot 2 (Green) */}
              <polygon
                points="460,186 540,151 590,173 510,208"
                fill="url(#slot-green)"
                opacity="0.9"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'P2', status: 'Available', fee: '30,000 VND/h' })}
              />
              {/* Slot 3 (Green) */}
              <polygon
                points="520,212 600,177 650,199 570,234"
                fill="url(#slot-green)"
                opacity="0.9"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'P3', status: 'Available', fee: '30,000 VND/h' })}
              />
            </g>

            {/* Middle Left Row: Green Slots */}
            <g className="slot-row" transform="translate(-130, 60)">
              <polygon
                points="400,160 480,125 530,147 450,182"
                fill="url(#slot-green)"
                opacity="0.85"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'A1', status: 'Available', fee: '30,000 VND/h' })}
              />
              <polygon
                points="460,186 540,151 590,173 510,208"
                fill="url(#slot-green)"
                opacity="0.85"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'A2', status: 'Available', fee: '30,000 VND/h' })}
              />
            </g>

            {/* Center Row: Yellow Reserved Slots */}
            <g className="slot-row" transform="translate(-30, 85)">
              {/* Reserved Slot 1 */}
              <polygon
                points="470,170 545,138 585,155 510,188"
                fill="url(#slot-yellow)"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'R1', status: 'Reserved', fee: 'Reserved (15:00 - 19:00)' })}
              />
              <circle cx="525" cy="162" r="7" fill="#3B3632" opacity="0.45" />

              {/* Reserved Slot 2 */}
              <polygon
                points="520,192 595,160 635,177 560,210"
                fill="url(#slot-yellow)"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'R2', status: 'Reserved', fee: 'Reserved (16:30 - 20:30)' })}
              />
              <circle cx="575" cy="184" r="7" fill="#3B3632" opacity="0.45" />
            </g>

            {/* Bottom Row: Yellow Reserved Cluster */}
            <g className="slot-row" transform="translate(-100, 150)">
              <polygon
                points="430,170 500,140 540,157 470,188"
                fill="url(#slot-yellow)"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'R3', status: 'Reserved', fee: 'Reserved' })}
              />
              <circle cx="483" cy="164" r="6" fill="#3B3632" opacity="0.45" />

              <polygon
                points="480,192 550,162 590,179 520,210"
                fill="url(#slot-yellow)"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'R4', status: 'Reserved', fee: 'Reserved' })}
              />
              <circle cx="533" cy="186" r="6" fill="#3B3632" opacity="0.45" />
            </g>

            {/* Right Row: Green Slots */}
            <g className="slot-row" transform="translate(60, 160)">
              <polygon
                points="460,186 540,151 590,173 510,208"
                fill="url(#slot-green)"
                opacity="0.9"
                className="interactive-slot"
                onClick={() => setSelectedSlot({ id: 'P7', status: 'Available', fee: '30,000 VND/h' })}
              />
            </g>

            {/* THE ACTIVE USER VEHICLE SLOT (P5 - Level 2) */}
            {/* Glowing Blue Highlight */}
            <g
              className="my-vehicle-slot"
              transform="translate(10, 195)"
              onClick={handleCenterOnVehicle}
            >
              {/* Slot pad */}
              <polygon
                points="450,180 525,148 565,166 490,198"
                fill="url(#slot-blue)"
                stroke="#E85A4F"
                strokeWidth="2.5"
              />

              <ellipse cx="507" cy="173" rx="42" ry="20" fill="none" stroke="#E85A4F" strokeWidth="1.5" opacity="0.45" />

              {/* Futuristic Isometric Car Silhouette */}
              <g transform="translate(485, 155)">
                {/* Car roof & body isometric */}
                <polygon points="20,5 38,-3 46,2 28,10" fill="#3B3632" />
                <polygon points="12,12 36,1 48,7 24,18" fill="#E98074" />
                <polygon points="12,12 24,18 24,24 12,18" fill="#C2453B" />
                <polygon points="24,18 48,7 48,13 24,24" fill="#A63C33" />
              </g>

              {/* Pin Icon Label */}
              <g transform="translate(470, 125)">
                <circle cx="16" cy="16" r="14" fill="#E98074" />
                <circle cx="16" cy="16" r="12" fill="#FFFFFF" />
                <path
                  d="M11 15L12 12C12.3 11 13 10.5 14 10.5H18C19 10.5 19.7 11 20 12L21 15"
                  stroke="#E98074"
                  strokeWidth="1.5"
                />
                <circle cx="13" cy="17" r="1" fill="#E98074" />
                <circle cx="19" cy="17" r="1" fill="#E98074" />
              </g>
            </g>

            {/* Other Parked Cars Outline silhouettes for realism */}
            <g transform="translate(320, 260)" opacity="0.3">
              <polygon points="20,5 38,-3 46,2 28,10" fill="#6F6A64" />
              <polygon points="12,12 36,1 48,7 24,18" fill="#8E8D8A" />
            </g>
            <g transform="translate(490, 310)" opacity="0.3">
              <polygon points="20,5 38,-3 46,2 28,10" fill="#6F6A64" />
              <polygon points="12,12 36,1 48,7 24,18" fill="#8E8D8A" />
            </g>
          </svg>

          {/* "Center on My Vehicle" Button (Bottom-Left of Map) */}
          <button
            type="button"
            className="btn-center-vehicle"
            onClick={handleCenterOnVehicle}
          >
            <span className="btn-center-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="12 2 15 9 12 7 9 9 12 2" fill="currentColor" />
              </svg>
            </span>
            <span>Center on My Vehicle</span>
          </button>
        </div>

        {/* Selected Slot Tooltip/Chip if clicked */}
        {selectedSlot && (
          <div className="slot-inspect-card">
            <div className="slot-inspect-header">
              <strong>Slot {selectedSlot.id}</strong>
              <button type="button" onClick={() => setSelectedSlot(null)}>✕</button>
            </div>
            <div className="slot-inspect-body">
              <div>Status: <span className="status-highlight">{selectedSlot.status}</span></div>
              <div>Rate: <strong>{selectedSlot.fee}</strong></div>
              {selectedSlot.status === 'Available' && (
                <button
                  type="button"
                  className="btn btn-primary-cyan btn-sm"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                  onClick={() => {
                    setReservationFeedback(`Successfully reserved Slot ${selectedSlot.id}!`);
                    setSelectedSlot(null);
                  }}
                >
                  Reserve This Slot
                </button>
              )}
            </div>
          </div>
        )}

        {/* FLOATING TOP-RIGHT CARD: Active Parking - P5 (Level 2) */}
        <ActiveParkingCard onPayNow={handlePayNow} onQrZoom={handleQrZoom} />

        {/* BOTTOM WIDGETS DOCK (Quick Reservation & Registered Vehicles) */}
        <div className="bottom-widgets-dock">
          {/* Card 1: Quick Reservation */}
          <div className="widget-card quick-reservation-card">
            <h4 className="widget-card__title">Quick Reservation</h4>
            <div className="quick-reservation-form">
              <div className="widget-select-wrap">
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="cyber-select"
                >
                  <option value="Level 1 - Zone A">Level 1 - Zone A</option>
                  <option value="Level 2 - Zone B">Level 2 - Zone B</option>
                  <option value="Level 2 - Zone P5">Level 2 - Zone P5</option>
                  <option value="Level 3 - Zone VIP">Level 3 - Zone VIP</option>
                </select>
                <span className="select-arrow">▼</span>
              </div>

              <input
                type="text"
                placeholder="Date/Time"
                value={reservationDateTime}
                onChange={(e) => setReservationDateTime(e.target.value)}
                className="cyber-input widget-date-input"
              />

              <button
                type="button"
                className="btn btn-primary-cyan btn-find-slots"
                onClick={handleFindSlots}
              >
                Find Slots
              </button>
            </div>
            {reservationFeedback && (
              <div className="widget-feedback">{reservationFeedback}</div>
            )}
          </div>

          {/* Card 2: Registered Vehicles */}
          <div className="widget-card registered-vehicles-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h4 className="widget-card__title" style={{ margin: 0 }}>Registered Vehicles ({vehicles.length})</h4>
              <button
                type="button"
                className="btn-add-vehicle-outline"
                style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={openAddVehicleModal}
              >
                + Add Vehicle
              </button>
            </div>
            <div className="registered-vehicles-list">
              {vehicles.map((v) => (
                <div key={v.id || v.vehicleId} className="vehicle-pill-item">
                  <div className="vehicle-car-thumb">
                    {/* Car icon */}
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E98074" strokeWidth="1.8">
                      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.7 0-1.4.3-1.8.8C4.3 8.7 3 10 3 10S1.5 10.6.5 11.1C-.2 11.3-.5 12.1-.5 13v3c0 .6.4 1 1 1h2" />
                      <circle cx="7" cy="17" r="2" />
                      <circle cx="17" cy="17" r="2" />
                    </svg>
                  </div>
                  <div className="vehicle-meta">
                    <span className="vehicle-name">
                      {v.brand} {v.model}
                      {v.isDefault && <span className="badge-primary-default" style={{ marginLeft: '6px' }}>Default</span>}
                    </span>
                    <span className="vehicle-plate">{v.plate || v.licensePlate}</span>
                  </div>
                  <div className="vehicle-actions-group">
                    <button
                      type="button"
                      className="btn-icon-action"
                      onClick={() => openEditVehicleModal(v)}
                      title="Edit vehicle"
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action btn-icon-action--delete"
                      onClick={() => handleDeleteVehicle(v)}
                      title="Delete vehicle"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Floating Bottom Navigation Bar */}
      <footer className="user-bottom-nav">
        <button
          type="button"
          className={`nav-tab-item ${activeTab === 'map' ? 'nav-tab-item--active' : ''}`}
          onClick={() => handleNavClick('map')}
        >
          <span className="nav-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </span>
          <span className="nav-tab-label">Map</span>
          {activeTab === 'map' && <span className="nav-active-pill"></span>}
        </button>

        <button
          type="button"
          className={`nav-tab-item ${activeTab === 'reservations' ? 'nav-tab-item--active' : ''}`}
          onClick={() => handleNavClick('reservations')}
        >
          <span className="nav-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <span className="nav-tab-label">Reservations</span>
          {activeTab === 'reservations' && <span className="nav-active-pill"></span>}
        </button>

        <button
          type="button"
          className={`nav-tab-item ${activeTab === 'vehicles' ? 'nav-tab-item--active' : ''}`}
          onClick={() => handleNavClick('vehicles')}
        >
          <span className="nav-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H7c-.7 0-1.4.3-1.8.8C4.3 8.7 3 10 3 10S1.5 10.6.5 11.1C-.2 11.3-.5 12.1-.5 13v3c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </span>
          <span className="nav-tab-label">Vehicles</span>
          {activeTab === 'vehicles' && <span className="nav-active-pill"></span>}
        </button>

        <button
          type="button"
          className={`nav-tab-item ${activeTab === 'profile' ? 'nav-tab-item--active' : ''}`}
          onClick={() => handleNavClick('profile')}
        >
          <span className="nav-tab-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="nav-tab-label">Profile</span>
          {activeTab === 'profile' && <span className="nav-active-pill"></span>}
        </button>
      </footer>

      {/* MODAL 1: Pay Now Checkout */}
      {isPayModalOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsPayModalOpen(false)}>
          <div className="api-modal pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Parking Payment Checkout</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsPayModalOpen(false)}>✕</button>
            </div>
            <div className="api-modal__body">
              <div className="checkout-summary">
                <div className="checkout-row">
                  <span>Slot / Location:</span>
                  <strong>P5 (Level 2) - SmartZone</strong>
                </div>
                <div className="checkout-row">
                  <span>Total Duration:</span>
                  <strong>~1h 45m</strong>
                </div>
                <div className="checkout-row checkout-row--total">
                  <span>Total Due:</span>
                  <strong className="text-cyan">55,000 VND</strong>
                </div>
              </div>

              <div className="payment-methods">
                <label className="payment-method-card">
                  <input type="radio" name="paymethod" defaultChecked />
                  <span>VietQR / Mobile Banking</span>
                </label>
                <label className="payment-method-card">
                  <input type="radio" name="paymethod" />
                  <span>VNPAY-QR</span>
                </label>
                <label className="payment-method-card">
                  <input type="radio" name="paymethod" />
                  <span>Credit / Debit Card (Visa, Master)</span>
                </label>
              </div>
            </div>
            <div className="api-modal__footer">
              <button type="button" className="btn btn-outline-cyan" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => {
                  alert('Payment processed successfully! Receipt sent to your email.');
                  setIsPayModalOpen(false);
                }}
              >
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add or Edit Vehicle */}
      {isAddVehicleModalOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsAddVehicleModalOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>{vehicleModalMode === 'add' ? 'Register New Vehicle' : 'Edit Vehicle Details'}</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsAddVehicleModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveVehicle}>
              <div className="api-modal__body">
                {vehicleModalError && (
                  <div className="modal-alert modal-alert--error">{vehicleModalError}</div>
                )}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Brand</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={vehicleFormData.brand}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, brand: e.target.value })}
                      placeholder="e.g. Toyota, Honda, Porsche"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Model</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={vehicleFormData.model}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, model: e.target.value })}
                      placeholder="e.g. Camry, Civic, Taycan"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>License Plate (VN Standard)</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={vehicleFormData.licensePlate}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, licensePlate: e.target.value })}
                    placeholder="e.g. 51F-999.88 or 30E-123.45"
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Vehicle Type</label>
                    <select
                      className="cyber-select"
                      style={{ width: '100%' }}
                      value={vehicleFormData.vehicleTypeId}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, vehicleTypeId: Number(e.target.value) })}
                    >
                      {vehicleTypes.map((vt) => (
                        <option key={vt.id} value={vt.id}>
                          {vt.name || vt.description || vt.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Color</label>
                    <input
                      type="text"
                      className="cyber-input"
                      value={vehicleFormData.color}
                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, color: e.target.value })}
                      placeholder="e.g. White, Black, Red"
                    />
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={vehicleFormData.isDefault}
                    onChange={(e) => setVehicleFormData({ ...vehicleFormData, isDefault: e.target.checked })}
                  />
                  <span>Set as primary default vehicle for quick parking reservations</span>
                </label>
              </div>
              <div className="api-modal__footer">
                <button type="button" className="btn btn-outline-cyan" onClick={() => setIsAddVehicleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary-cyan" disabled={vehicleModalLoading}>
                  {vehicleModalLoading ? 'Saving...' : (vehicleModalMode === 'add' ? 'Save Vehicle' : 'Update Vehicle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QR Code Zoom / Scan */}
      {isQrZoomOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsQrZoomOpen(false)}>
          <div className="api-modal qr-zoom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Check-in / Gate Barrier QR Code</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsQrZoomOpen(false)}>✕</button>
            </div>
            <div className="api-modal__body text-center" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ background: '#FFFFFF', display: 'inline-block', padding: '16px', borderRadius: '12px' }}>
                <svg width="220" height="220" viewBox="0 0 110 110" fill="none">
                  <rect width="110" height="110" rx="4" fill="#FFFFFF" />
                  <rect x="12" y="12" width="28" height="28" fill="#000" />
                  <rect x="16" y="16" width="20" height="20" fill="#FFFFFF" />
                  <rect x="20" y="20" width="12" height="12" fill="#000" />
                  <rect x="70" y="12" width="28" height="28" fill="#000" />
                  <rect x="74" y="16" width="20" height="20" fill="#FFFFFF" />
                  <rect x="78" y="20" width="12" height="12" fill="#000" />
                  <rect x="12" y="70" width="28" height="28" fill="#000" />
                  <rect x="16" y="74" width="20" height="20" fill="#FFFFFF" />
                  <rect x="20" y="78" width="12" height="12" fill="#000" />
                  <rect x="46" y="14" width="6" height="6" fill="#000" />
                  <rect x="56" y="14" width="6" height="6" fill="#000" />
                  <rect x="46" y="26" width="6" height="6" fill="#000" />
                  <rect x="46" y="46" width="18" height="18" fill="#E98074" rx="2" />
                  <rect x="72" y="48" width="6" height="6" fill="#000" />
                  <rect x="52" y="74" width="6" height="6" fill="#000" />
                  <rect x="80" y="80" width="6" height="6" fill="#000" />
                </svg>
              </div>
              <p style={{ marginTop: '1rem', color: '#6F6A64', fontSize: '0.9rem' }}>
                Hold near scanner at Gate Barrier 2 for automated entry & exit.
              </p>
            </div>
            <div className="api-modal__footer">
              <button type="button" className="btn btn-primary-cyan" onClick={() => setIsQrZoomOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Nav Tab Modals (Reservations, Vehicles, Profile) */}
      {activeSubModal && (
        <div className="api-modal-backdrop" onClick={() => { setActiveSubModal(null); setActiveTab('map'); }}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>
                {activeSubModal === 'reservations' && 'My Parking Reservations'}
                {activeSubModal === 'vehicles' && 'Manage Registered Vehicles'}
                {activeSubModal === 'profile' && 'User Account Profile'}
              </h3>
              <button
                type="button"
                className="api-modal__close"
                onClick={() => { setActiveSubModal(null); setActiveTab('map'); }}
              >
                ✕
              </button>
            </div>

            <div className="api-modal__body">
              {activeSubModal === 'reservations' && (
                <div className="reservations-modal-content">
                  {reservations.map((r) => (
                    <div key={r.id} className="reservation-item-card">
                      <div className="res-slot">
                        <strong>Slot {r.slot}</strong>
                        <span className={`status-pill ${r.status === 'Active' ? 'status-pill--success' : 'status-pill--info'}`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="res-meta">
                        <span>Time: {r.time}</span>
                        <span>Fee: {r.fee}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeSubModal === 'vehicles' && (
                <div className="vehicles-modal-content">
                  {vehicles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#8E8D8A' }}>
                      No registered vehicles found. Add one below!
                    </div>
                  ) : (
                    vehicles.map((v) => (
                      <div key={v.id || v.vehicleId} className="vehicle-list-card-full">
                        <div className="vehicle-card-details">
                          <div className="vehicle-card-title">
                            <span>{v.brand} {v.model}</span>
                            {v.isDefault ? (
                              <span className="badge-primary-default">★ Primary Default</span>
                            ) : (
                              <button
                                type="button"
                                className="btn-set-default"
                                onClick={() => handleSetDefaultVehicle(v)}
                                title="Set as primary default vehicle"
                              >
                                Set Default
                              </button>
                            )}
                          </div>
                          <div className="vehicle-card-sub">
                            <span className="badge-plate">{v.plate || v.licensePlate}</span>
                            <span>{v.color || 'Standard'}</span>
                            <span>• {v.vehicleType || 'Vehicle'}</span>
                          </div>
                        </div>

                        <div className="vehicle-actions-group">
                          <button
                            type="button"
                            className="btn-icon-action"
                            onClick={() => openEditVehicleModal(v)}
                            title="Edit vehicle details"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action btn-icon-action--delete"
                            onClick={() => handleDeleteVehicle(v)}
                            title="Delete vehicle"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-cyan btn-full"
                    style={{ marginTop: '1rem' }}
                    onClick={openAddVehicleModal}
                  >
                    + Register Another Vehicle
                  </button>
                </div>
              )}

              {activeSubModal === 'profile' && (
                <div className="profile-modal-content">
                  <div className="profile-info-row">
                    <span className="profile-label">Full Name:</span>
                    <strong>{currentUserProfile?.fullName || user?.fullName || 'Alex Rivers'}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-label">Username:</span>
                    <strong>{currentUserProfile?.username || user?.username || 'alex.rivers'}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-label">Email:</span>
                    <strong>{currentUserProfile?.email || user?.email || 'alex.rivers@xxivparking.vn'}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-label">Phone:</span>
                    <strong>{currentUserProfile?.phoneNumber || user?.phoneNumber || '+84 988 123 456'}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-label">Role:</span>
                    <strong className="text-cyan">{roleLabel(currentUserProfile?.role)}</strong>
                  </div>
                  <div className="profile-info-row">
                    <span className="profile-label">Status:</span>
                    <span className="status-pill status-pill--success">{currentUserProfile?.status || 'Active'}</span>
                  </div>

                  <div className="profile-actions" style={{ marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary-cyan btn-full"
                      onClick={openEditProfile}
                    >
                      Edit Profile
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-cyan btn-full"
                      style={{ marginTop: '0.65rem' }}
                      onClick={openChangePassword}
                    >
                      Change Password
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-outline btn-full"
                      style={{ marginTop: '0.65rem' }}
                      onClick={onLogout}
                    >
                      Log Out of Session
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="api-modal__footer">
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => { setActiveSubModal(null); setActiveTab('map'); }}
              >
                Back to Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsEditProfileOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Edit Account Profile</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsEditProfileOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="api-modal__body">
                {profileFeedback.text && (
                  <div className={`modal-alert modal-alert--${profileFeedback.type}`}>
                    {profileFeedback.text}
                  </div>
                )}
                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Full Name</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={profileFormData.fullName}
                    onChange={(e) => setProfileFormData({ ...profileFormData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Email Address</label>
                  <input
                    type="email"
                    className="cyber-input"
                    value={profileFormData.email}
                    onChange={(e) => setProfileFormData({ ...profileFormData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Phone Number</label>
                  <input
                    type="text"
                    className="cyber-input"
                    value={profileFormData.phoneNumber}
                    onChange={(e) => setProfileFormData({ ...profileFormData, phoneNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Avatar Image URL (Optional)</label>
                  <input
                    type="url"
                    className="cyber-input"
                    value={profileFormData.avatarUrl}
                    onChange={(e) => setProfileFormData({ ...profileFormData, avatarUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="api-modal__footer">
                <button type="button" className="btn btn-outline-cyan" onClick={() => setIsEditProfileOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary-cyan" disabled={isProfileUpdating}>
                  {isProfileUpdating ? 'Updating...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Change Password Modal (Authenticated PUT /api/Users/profile/change-password) */}
      {isChangePasswordOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsChangePasswordOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Change Password</h3>
              <button type="button" className="api-modal__close" onClick={() => setIsChangePasswordOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePassword}>
              <div className="api-modal__body">
                {passwordFeedback.text && (
                  <div className={`modal-alert modal-alert--${passwordFeedback.type}`}>
                    {passwordFeedback.text}
                  </div>
                )}
                <p style={{ color: '#6F6A64', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                  Authenticated password change directly via backend API. No email token required.
                </p>

                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Current Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPasswordVisibility.current ? 'text' : 'password'}
                      className="cyber-input"
                      value={passwordFormData.currentPassword}
                      onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="password-eye-toggle"
                      aria-label="Show or hide password"
                      onClick={() => setShowPasswordVisibility(p => ({ ...p, current: !p.current }))}
                    >
                      {showPasswordVisibility.current ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>New Password (min. 6 characters)</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPasswordVisibility.new ? 'text' : 'password'}
                      className="cyber-input"
                      value={passwordFormData.newPassword}
                      onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="password-eye-toggle"
                      aria-label="Show or hide password"
                      onClick={() => setShowPasswordVisibility(p => ({ ...p, new: !p.new }))}
                    >
                      {showPasswordVisibility.new ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ color: '#6F6A64', fontSize: '0.85rem' }}>Confirm New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPasswordVisibility.confirm ? 'text' : 'password'}
                      className="cyber-input"
                      value={passwordFormData.confirmPassword}
                      onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="password-eye-toggle"
                      aria-label="Show or hide password"
                      onClick={() => setShowPasswordVisibility(p => ({ ...p, confirm: !p.confirm }))}
                    >
                      {showPasswordVisibility.confirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="api-modal__footer">
                <button type="button" className="btn btn-outline-cyan" onClick={() => setIsChangePasswordOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary-cyan" disabled={isPasswordChanging}>
                  {isPasswordChanging ? 'Changing...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
