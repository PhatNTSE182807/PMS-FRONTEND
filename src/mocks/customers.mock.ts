import { toSearchable } from '@/lib/text'
import type { PaginatedResponse } from '@/types/common.dto'
import type { CustomerAccountDTO, CustomerListQuery } from '@/types/identity.dto'
import { mockResponse } from './mockApi'

/** Seed customers for demo mode; `role` mirrors what GET /Users returns. */
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
].map(([userName, email, phoneNumber], index) => ({
  id: `cus-${String(index + 1).padStart(4, '0')}`,
  userName,
  email,
  phoneNumber,
  role: 'User',
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
        [account.userName, account.email, account.phoneNumber].some((value) => toSearchable(value ?? '').includes(term)),
    )
    .sort((a, b) => a.userName.localeCompare(b.userName))

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
}
