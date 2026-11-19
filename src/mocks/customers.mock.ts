import { toSearchable } from '@/lib/text'
import type { PaginatedResponse } from '@/types/common.dto'
import type { CustomerAccountDTO, CustomerListQuery } from '@/types/identity.dto'
import { mockResponse } from './mockApi'

/** Seed customers for demo mode; mirrors what GET /admin/customers returns. */
const CUSTOMERS: CustomerAccountDTO[] = [
  ['nguyentanphat', 'phat@gmail.com', '0977654654'],
  ['buihaminhnhat', 'nhat@gmail.com', '0986456456'],
  ['alex.rivers', 'alex.rivers@xxivparking.vn', '0988123456'],
  ['tranthuha', 'thuha.tran@gmail.com', '0903112233'],
  ['lequocbao', 'baolq@outlook.com', '0912445566'],
  ['phamngoclan', 'lan.pham@gmail.com', '0935778899'],
  ['hoangminhduc', 'duc.hoang@yahoo.com', '0868123987'],
  ['vothanhtam', 'tam.vo@gmail.com', '0789456123'],
  ['dangthuytrang', 'trang.dang@gmail.com', '0399887766'],
  ['ngogiahuy', 'huy.ngo@fpt.edu.vn', '0377665544'],
  ['duongbaongoc', 'ngoc.duong@gmail.com', '0944221100'],
  ['lyhaiyen', 'yen.ly@gmail.com', '0922334455'],
  ['huynhvankhoa', 'khoa.huynh@gmail.com', '0856998877'],
  ['phanthimai', 'mai.phan@gmail.com', '0707112244'],
  ['doanhtuan', 'tuan.do@gmail.com', '0383556677'],
].map(([userName, email, phoneNumber], index): CustomerAccountDTO => ({
  id: `cus-${String(index + 1).padStart(4, '0')}`,
  userName,
  email,
  phoneNumber,
  role: 'User',
  isActive: true,
  // One demo customer is waiting for their account to be deleted
  deletionRequest:
    index === 3
      ? { id: 1, reason: 'I moved to another city.', status: 'Pending', requestedAt: new Date(Date.now() - 3_600_000).toISOString(), closedAt: null }
      : null,
}))

/** Keeps only customer accounts, applies the search and returns the requested page. */
export function toCustomerPage(
  accounts: CustomerAccountDTO[],
  { search, pageNumber, pageSize }: CustomerListQuery,
): PaginatedResponse<CustomerAccountDTO> {
  const term = search ? toSearchable(search) : ''
  const matches = accounts
    .filter((account) => account.role?.toLowerCase() === 'user')
    .filter(
      (account) =>
        !term ||
        [account.fullName, account.userName, account.email, account.phoneNumber].some((value) => toSearchable(value ?? '').includes(term)),
    )
    // Accounts waiting to be deleted come first (oldest request first), then the rest by name
    .sort((a, b) => {
      const ra = a.deletionRequest?.requestedAt
      const rb = b.deletionRequest?.requestedAt
      if (ra && rb) return ra.localeCompare(rb)
      if (ra || rb) return ra ? -1 : 1
      return (a.fullName || a.userName).localeCompare(b.fullName || b.userName)
    })

  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize))
  const page = Math.min(Math.max(1, pageNumber), totalPages)

  return {
    items: matches.slice((page - 1) * pageSize, page * pageSize),
    pageNumber: page,
    pageSize,
    totalCount: matches.length,
    totalPages,
  }
}

export const customersMock = {
  list(query: CustomerListQuery): Promise<PaginatedResponse<CustomerAccountDTO>> {
    return mockResponse(() => toCustomerPage(CUSTOMERS, query))
  },

  setActive(id: string, isActive: boolean): Promise<boolean> {
    return mockResponse(() => {
      const account = CUSTOMERS.find((c) => c.id === id)
      if (!account) throw new Error('The account no longer exists.')
      account.isActive = isActive
      if (!isActive) account.deletionRequest = null
      return true
    })
  },
}
