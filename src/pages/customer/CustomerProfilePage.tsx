import { useCallback, useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  IdCard,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  User,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import {
  STRENGTH_LABEL,
  formatMonthYear,
  initials,
  memberCode,
  passwordScore,
  resolveMediaUrl,
} from '@/components/customer/customerFormat'
import { roleLabel, useAuth, useSignOut } from '@/hooks/useAuth'
import { useChangePassword, useProfile, useUpdateProfile, useUploadAvatar, useVehicles } from '@/hooks/useProfile'
import { isValidPassword, PASSWORD_RULE_HINT, PASSWORD_RULE_MESSAGE, PASSWORD_RULES } from '@/lib/password'
import type { UserProfileDTO } from '@/types/profile.dto'



interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  icon?: LucideIcon
  aside?: ReactNode
}

function Field({ id, label, icon: Icon, aside, className = '', ...input }: FieldProps) {
  return (
    <div className="cx-field">
      <div className="cx-field__label-row">
        <label className="cx-field__label" htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className="cx-control">
        {Icon && <span className="cx-control__icon"><Icon aria-hidden /></span>}
        <input id={id} className={`cx-input ${Icon ? 'cx-input--with-icon' : ''} ${className}`} {...input} />
      </div>
    </div>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete, placeholder }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="cx-field">
      <label className="cx-field__label" htmlFor={id}>{label}</label>
      <div className="cx-control">
        <span className="cx-control__icon"><Lock aria-hidden /></span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="cx-input cx-input--with-icon cx-input--with-end"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <span className="cx-control__end">
          <button type="button" className="cx-icon-btn" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'}>
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        </span>
      </div>
    </div>
  )
}

/** Short description of this browser for the "active sessions" list. */
function thisDevice(): string {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'this device'
  return `${browser} on ${os}`
}

const SECTIONS = [
  { href: '#personal', label: 'Personal Information', icon: UserRound },
  { href: '#security', label: 'Change Password', icon: KeyRound },
  { href: '#sessions', label: 'Active Sessions', icon: MonitorSmartphone },
]

export default function CustomerProfilePage() {
  const { user } = useAuth()
  const profileQuery = useProfile()
  const profile = profileQuery.data
  const { data: vehicles = [] } = useVehicles()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const changePassword = useChangePassword()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarClick = () => {
    if (uploadAvatar.isPending) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar image must be smaller than 2 MB.')
      return
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF and WebP images are allowed.')
      return
    }

    try {
      await uploadAvatar.mutateAsync(file)
      toast.success('Avatar updated successfully!')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to upload avatar.'))
    }
  }

  // Personal information form, filled once the profile arrives
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', citizenId: '' })
  const [formError, setFormError] = useState('')
  const resetForm = useCallback((p: UserProfileDTO) => {
    setForm({ fullName: p.fullName, email: p.email, phoneNumber: p.phoneNumber, citizenId: p.citizenId ?? '' })
  }, [])
  useEffect(() => {
    if (profile) resetForm(profile)
  }, [profile, resetForm])

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const score = passwordScore(passwords.newPassword)
  // Accounts created with Google have no password yet: they set one without the current password.
  const hasPassword = profile?.hasPassword !== false

  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'
  const daysMember = profile?.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)) : 0
  const isDirty =
    profile !== undefined &&
    (form.fullName !== profile.fullName ||
      form.phoneNumber !== profile.phoneNumber ||
      form.citizenId !== (profile.citizenId ?? ''))

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.fullName.trim()) return setFormError('Full name is required.')
    if (!form.phoneNumber.trim()) return setFormError('Phone number is required.')
    if (!form.citizenId.trim()) return setFormError('Citizen ID is required.')
    if (!/^\d{12}$/.test(form.citizenId.trim())) return setFormError('Citizen ID must have exactly 12 digits.')

    updateProfile.mutate(
      {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        avatarUrl: profile?.avatarUrl ?? '',
        citizenId: form.citizenId.trim(),
      },
      {
        onSuccess: () => toast.success('Profile updated.'),
        onError: (error) => setFormError(getErrorMessage(error, 'Could not update your profile.')),
      },
    )
  }

  const savePassword = (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    if (hasPassword && !passwords.currentPassword) return setPasswordError('Enter your current password.')
    if (!isValidPassword(passwords.newPassword)) return setPasswordError(PASSWORD_RULE_MESSAGE)
    if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError('The new passwords do not match.')

    changePassword.mutate(passwords, {
      onSuccess: () => {
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
        toast.success(hasPassword ? 'Password changed.' : 'Password set. You can now also sign in with your email.')
      },
      onError: (error) => setPasswordError(getErrorMessage(error, 'Could not change the password. Check your current password.')),
    })
  }

  const handleLogout = useSignOut()

  return (
    <>
      <header className="cx-page-head">
        <div>
          <nav className="cx-crumbs" aria-label="Breadcrumb">
            <span>Account settings</span> <ChevronRight aria-hidden /> <span className="cx-crumbs__current">Personal profile</span>
          </nav>
          <h1 className="cx-page-title">User Profile &amp; Security</h1>
          <p className="cx-page-lead">Manage your personal details, contact information and sign-in security.</p>
        </div>
        <span className="cx-pill">
          <span className="cx-dot cx-dot--gold" aria-hidden="true" /> Telemetry link active
        </span>
      </header>

      <div className="cx-split cx-split--sidebar">
        <aside className="cx-stack">
          <section className="cx-card cx-profile-card" aria-label="Account summary">
            <div className="cx-profile-card__who">
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`cx-avatar cx-avatar--lg cx-avatar--clickable ${uploadAvatar.isPending ? 'cx-avatar--loading' : ''}`}
                  onClick={handleAvatarClick}
                  disabled={uploadAvatar.isPending}
                  title="Click to upload profile picture (Max 2 MB)"
                  aria-label="Upload profile picture"
                >
                  {resolveMediaUrl(profile?.avatarUrl) ? (
                    <img src={resolveMediaUrl(profile?.avatarUrl)} alt={name} />
                  ) : (
                    initials(name)
                  )}
                  <span className="cx-avatar-overlay">
                    {uploadAvatar.isPending ? (
                      <Loader2 className="cx-avatar-overlay__icon animate-spin" aria-hidden />
                    ) : (
                      <>
                        <Camera className="cx-avatar-overlay__icon" aria-hidden />
                        <span className="cx-avatar-overlay__text">Photo</span>
                      </>
                    )}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="cx-profile-card__name">{name}</p>
                <p className="cx-profile-card__id">{memberCode(profile?.userId ?? user?.userId)}</p>
                <p className="cx-profile-card__joined">Joined {formatMonthYear(profile?.createdAt)}</p>
              </div>
            </div>

            <div className="cx-status-row">
              <span>
                <span className={`cx-dot ${profile?.isActive === false ? 'cx-dot--red' : ''}`} aria-hidden="true" />
                {profile?.isActive === false ? 'Account inactive' : 'Account active'}
              </span>
              <ShieldCheck aria-hidden />
            </div>

            <div className="cx-stats">
              <div>
                <strong>{vehicles.length}</strong>
                <span>Registered vehicles</span>
              </div>
              <div>
                <strong style={{ color: 'var(--cx-primary)' }}>{daysMember}</strong>
                <span>Days as member</span>
              </div>
              <div>
                <strong style={{ color: 'var(--cx-gold)' }}>{roleLabel(profile?.role ?? user?.role)}</strong>
                <span>Account type</span>
              </div>
            </div>

            <nav className="cx-sidenav" aria-label="Profile sections">
              {SECTIONS.map(({ icon: Icon, ...s }, i) => (
                <a key={s.href} href={s.href} className={i === 0 ? 'is-active' : undefined}>
                  <Icon aria-hidden /> {s.label} <ChevronRight className="cx-sidenav__arrow" aria-hidden />
                </a>
              ))}
            </nav>
          </section>
        </aside>

        <div className="cx-stack">
          <section className="cx-card" id="personal" aria-labelledby="personal-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon"><User aria-hidden /></span>
                <div>
                  <h2 className="cx-card__title" id="personal-title">Personal Information</h2>
                  <p className="cx-card__subtitle">Update your contact details and default gate credentials.</p>
                </div>
              </div>
            </div>

            {profileQuery.isPending ? (
              <div className="cx-skeleton" style={{ height: '14rem' }} />
            ) : (
              <form className="cx-form" onSubmit={saveProfile} noValidate>
                <Field
                  id="profile-name"
                  label="Full legal name"
                  icon={User}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  autoComplete="name"
                />
                <Field
                  id="profile-email"
                  label="Primary email address"
                  icon={Mail}
                  type="email"
                  value={form.email}
                  disabled
                  readOnly
                  autoComplete="email"
                  aside={<span className="cx-field__hint" style={{ margin: 0, fontSize: '0.75rem' }}>Cannot be changed</span>}
                />
                <Field
                  id="profile-phone"
                  label="Contact phone (gate alerts)"
                  icon={Phone}
                  type="tel"
                  className="cx-mono"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  autoComplete="tel"
                />
                <Field
                  id="profile-citizen-id"
                  label="Citizen ID *"
                  icon={IdCard}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="12 digits"
                  className="cx-mono"
                  value={form.citizenId}
                  onChange={(e) => setForm({ ...form, citizenId: e.target.value.replace(/\D/g, '') })}
                  autoComplete="off"
                  aside={!profile?.citizenId ? <span className="cx-field__hint" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--cx-gold, #f59e0b)' }}>Required to register vehicles</span> : undefined}
                />
                {formError && <p className="cx-error" role="alert">{formError}</p>}
                <div className="cx-actions">
                  <button
                    type="button"
                    className="cx-btn cx-btn--ghost"
                    disabled={!isDirty}
                    onClick={() => profile && resetForm(profile)}
                  >
                    Discard
                  </button>
                  <button type="submit" className="cx-btn cx-btn--teal" disabled={!isDirty || updateProfile.isPending}>
                    {updateProfile.isPending ? 'Saving...' : 'Save profile changes'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="cx-card" id="security" aria-labelledby="security-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon cx-card__icon--gold"><ShieldCheck aria-hidden /></span>
                <div>
                  <h2 className="cx-card__title" id="security-title">Security &amp; Password Management</h2>
                </div>
              </div>
            </div>

            <form className="cx-form" onSubmit={savePassword} noValidate>
              <p className="cx-note">
                <Info aria-hidden />
                {/* Google-only accounts set a first password without the current one (backend AddPasswordAsync). */}
                {hasPassword
                  ? PASSWORD_RULE_HINT
                  : `You signed up with Google, so there is no password yet. Set one to also sign in with your email address. ${PASSWORD_RULE_MESSAGE}`}
              </p>

              {hasPassword && (
                <PasswordField
                  id="pw-current"
                  label="Current password"
                  value={passwords.currentPassword}
                  onChange={(v) => setPasswords({ ...passwords, currentPassword: v })}
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                />
              )}
              <div className="cx-grid-2">
                <PasswordField
                  id="pw-new"
                  label="New password"
                  value={passwords.newPassword}
                  onChange={(v) => setPasswords({ ...passwords, newPassword: v })}
                  autoComplete="new-password"
                  placeholder="6+ characters, A–Z and a symbol"
                />
                <PasswordField
                  id="pw-confirm"
                  label="Confirm new password"
                  value={passwords.confirmPassword}
                  onChange={(v) => setPasswords({ ...passwords, confirmPassword: v })}
                  autoComplete="new-password"
                  placeholder="Re-enter the new password"
                />
              </div>

              <div className="cx-strength" data-score={score}>
                <div className="cx-strength__row">
                  <span>Security strength rating</span>
                  <span className="cx-strength__verdict">
                    {score === 0 ? 'Not set' : `${STRENGTH_LABEL[score]} (${passwords.newPassword.length} chars)`}
                  </span>
                </div>
                <div className="cx-strength__bars" aria-hidden="true">
                  <span /><span /><span /><span />
                </div>
                {/* The API rule, ticked off live so the user sees what is still missing before submitting. */}
                <ul className="cx-strength__rules" aria-label="Password requirements">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(passwords.newPassword)
                    return (
                      <li key={rule.id} data-met={met}>
                        {met ? <Check aria-hidden /> : <X aria-hidden />}
                        {rule.label}
                        <span className="sr-only">{met ? ' (met)' : ' (missing)'}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {passwordError && <p className="cx-error" role="alert">{passwordError}</p>}
              <div className="cx-actions">
                <button type="submit" className="cx-btn" disabled={changePassword.isPending}>
                  {changePassword.isPending ? 'Updating...' : hasPassword ? 'Update password' : 'Set password'}
                </button>
              </div>
            </form>

            <div style={{ marginTop: '1.75rem' }}>
              <p className="cx-field__label" style={{ marginBottom: '0.6rem' }}>Sign-in method</p>
              <div className="cx-device">
                <span className="cx-device__icon">{hasPassword ? <KeyRound aria-hidden /> : <Mail aria-hidden />}</span>
                <div className="cx-device__text">
                  <p className="cx-device__name">
                    {hasPassword ? 'Email & password' : 'Google account'}
                    <span className="cx-chip">Connected</span>
                  </p>
                  <p className="cx-device__meta cx-mono">{profile?.email ?? user?.email}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="cx-card" id="sessions" aria-labelledby="sessions-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon"><MonitorSmartphone aria-hidden /></span>
                <div>
                  <h2 className="cx-card__title" id="sessions-title">Active Login Sessions</h2>
                  <p className="cx-card__subtitle">Devices signed in to your account.</p>
                </div>
              </div>
              <button type="button" className="cx-btn cx-btn--danger" onClick={handleLogout}>
                <LogOut aria-hidden /> Log out
              </button>
            </div>

            <div className="cx-device">
              <span className="cx-device__icon"><Laptop aria-hidden /></span>
              <div className="cx-device__text">
                <p className="cx-device__name">
                  {thisDevice()}
                  <span className="cx-chip"><span className="cx-dot" aria-hidden="true" /> Active now</span>
                </p>
                <p className="cx-device__meta">Signed in as {user?.username || user?.email}</p>
              </div>
              <span className="cx-chip cx-chip--teal">Current device</span>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
