import { KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatPhone, initials } from '@/lib/format'
import type { UserDTO } from '@/types/identity.dto'
import { roleOption, shiftLabel, statusOption } from './staffLabels'

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
]

/** Stable colour per user, so avatars do not change between renders or pages. */
const avatarColor = (id: string) =>
  AVATAR_COLORS[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length]

const COLUMNS = ['Employee code', 'Full name', 'Email & phone', 'Role', 'Assigned lots', 'Created', 'Status', 'Actions']
const MAX_LOT_CHIPS = 2
/** Actions stay visible while the table scrolls horizontally on narrower screens. */
const STICKY_ACTIONS = 'sticky right-0 shadow-[-12px_0_12px_-12px_rgb(15_23_42/0.15)]'

interface StaffTableProps {
  users: UserDTO[]
  isLoading: boolean
  onEdit: (user: UserDTO) => void
  onToggleLock: (user: UserDTO) => void
  onResetPassword: (user: UserDTO) => void
}

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="mb-1.5 h-4 w-44" /><Skeleton className="h-3 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-5 w-40 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
      <TableCell className={`${STICKY_ACTIONS} bg-white`}><Skeleton className="ml-auto h-8 w-24" /></TableCell>
    </TableRow>
  ))
}

export function StaffTable({ users, isLoading, onEdit, onToggleLock, onResetPassword }: StaffTableProps) {
  return (
    <Table aria-busy={isLoading}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((column) => (
            <TableHead key={column} className={column === 'Actions' ? `${STICKY_ACTIONS} bg-slate-50 text-right` : undefined}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <SkeletonRows />
        ) : (
          users.map((user) => {
            const role = roleOption(user.role)
            const status = statusOption(user.status)
            const isLocked = user.status !== 'ACTIVE'
            const extraLots = user.assignedParkingLots.length - MAX_LOT_CHIPS

            return (
              <TableRow key={user.id}>
                <TableCell className="font-mono text-xs font-medium text-slate-500">{user.employeeCode}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      aria-hidden
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${avatarColor(user.id)}`}
                    >
                      {initials(user.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium whitespace-nowrap text-slate-900">{user.fullName}</p>
                      {user.shift && <p className="text-xs text-slate-500">{shiftLabel(user.shift)}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="whitespace-nowrap text-slate-900">{user.email}</p>
                  <p className="text-xs whitespace-nowrap text-slate-500">{formatPhone(user.phoneNumber)}</p>
                </TableCell>
                <TableCell>
                  <Badge tone={role.tone}>{role.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {user.assignedParkingLots.slice(0, MAX_LOT_CHIPS).map((lot) => (
                      <Badge key={lot.id} className="max-w-[12rem] truncate" title={lot.name}>
                        {lot.name.replace(/ Parking$/, '')}
                      </Badge>
                    ))}
                    {extraLots > 0 && (
                      <Badge title={user.assignedParkingLots.slice(MAX_LOT_CHIPS).map((l) => l.name).join(', ')}>
                        +{extraLots}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <Badge tone={status.tone}>
                    <StatusDot />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className={`${STICKY_ACTIONS} bg-white group-hover:bg-slate-50`}>
                  <div className="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon" title="Edit" aria-label={`Edit ${user.fullName}`} onClick={() => onEdit(user)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isLocked ? 'Activate' : 'Deactivate'}
                      aria-label={`${isLocked ? 'Activate' : 'Deactivate'} ${user.fullName}`}
                      className={isLocked ? 'text-emerald-600 hover:text-emerald-700' : 'text-rose-600 hover:text-rose-700'}
                      onClick={() => onToggleLock(user)}
                    >
                      {isLocked ? <UserCheck /> : <UserX />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Reset password"
                      aria-label={`Reset password for ${user.fullName}`}
                      onClick={() => onResetPassword(user)}
                    >
                      <KeyRound />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
