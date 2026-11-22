import { formatNumber } from '@/lib/format'

export type LegalDocId = 'terms' | 'privacy'

export interface LegalSection {
  id: string
  title: string
  items: string[]
}

export interface LegalDoc {
  title: string
  intro: string
  summary: string[]
  sections: LegalSection[]
}

/** Shown as the date of the current version. Change it whenever the text below changes. */
export const LEGAL_UPDATED_AT = '2026-11-23'
export const LEGAL_VERSION = '1.0'

/**
 * The rule values quoted in the text, in one place. They mirror the backend defaults (`ParkingOptions`,
 * `VehicleDocumentStorageOptions`, `NotificationJobs`): update them here when those defaults change.
 */
export const legalValues = () => ({
  maxDays: 30,
  maxBookings: 2,
  earlyMinutes: 15,
  holdNoDeposit: 15,
  holdDeposit: 30,
  deposit: formatNumber(30_000),
  depositDeadline: 10,
  cancelMinutes: 30,
  towStaffMinutes: 15,
  towMinutes: 30,
  exitWindow: 15,
  lateFee: formatNumber(10_000),
  roundTo: formatNumber(1_000),
  minTopUp: formatNumber(10_000),
  maxTopUp: formatNumber(10_000_000),
  abandonedDays: 7,
  documentDays: 30,
  readNoticeDays: 60,
  unreadNoticeDays: 180,
})

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    intro: 'These terms apply when you use XXIV Parking to register a vehicle, book a bay, park or pay.',
    summary: [
      'Register only a vehicle you own or are allowed to drive. Staff review its papers.',
      'Your bay is held {holdNoDeposit} minutes after your arrival time, or {holdDeposit} minutes with a deposit.',
      'Cancel at least {cancelMinutes} minutes before arrival to get your full deposit back in your wallet.',
      'Fees are charged per time block from the price list of each parking lot.',
      'If you pay before leaving, exit within {exitWindow} minutes to avoid a late fee.',
    ],
    sections: [
      {
        id: 'accounts',
        title: 'Your account',
        items: [
          'Give accurate details and keep them up to date.',
          'Keep your password private. You are responsible for what is done with your account.',
          'One license plate can belong to only one account.',
          'An Admin can lock an account that breaks these terms or misuses the service.',
        ],
      },
      {
        id: 'vehicles',
        title: 'Registering a vehicle',
        items: [
          'XXIV Parking accepts 4-seat cars, 7-seat cars and motorbikes.',
          'You upload photos of your Citizen ID and vehicle registration certificate, and confirm that you own or are allowed to drive the vehicle.',
          'Staff compare the papers with the details you entered. If a registration is rejected, the vehicle is removed from your account and you can register it again.',
        ],
      },
      {
        id: 'bookings',
        title: 'Booking a bay',
        items: [
          'Cars can be booked up to {maxDays} days ahead. Motorbikes do not book ahead: they claim a free bay right away, with no deposit.',
          'Each account can have {maxBookings} active bookings, and each vehicle can have one.',
          'You can check in from {earlyMinutes} minutes before your arrival time until your hold ends.',
          'A deposit is optional: {deposit} VND per car, paid within {depositDeadline} minutes of booking. It is deducted from your fee at check-out.',
          'If you do not check in before your hold ends, the booking becomes a no-show and the bay is released.',
          'If you chose a departure time and stay past it, your vehicle may be towed to a penalty bay after {towStaffMinutes} minutes when another booking is waiting for the bay, and is towed automatically after {towMinutes} minutes. A towing penalty is added at check-out.',
        ],
      },
      {
        id: 'cancellations',
        title: 'Changes, cancellations and refunds',
        items: [
          'You can change your arrival time or bay up to {cancelMinutes} minutes before arrival.',
          'If you cancel at least {cancelMinutes} minutes before arrival, your full deposit is refunded to your XXIV Wallet.',
          'If you cancel later or do not arrive, the deposit is kept.',
          'If the parking lot cancels your booking, your deposit is refunded in full.',
        ],
      },
      {
        id: 'fees',
        title: 'Parking fees and payment',
        items: [
          'Fees follow the price list of the parking lot and your vehicle type. The first time block is owed as soon as the vehicle enters.',
          'A daily cap may apply, and fees are rounded up to the nearest {roundTo} VND.',
          'A vehicle already inside keeps the price it entered with. A new price applies to vehicles entering after the change.',
          'You can pay at the exit lane, at the counter or in the app.',
          'If you pay at the counter or in the app, you have {exitWindow} minutes to leave. After that, the fee is calculated again from your entry time, what you paid is subtracted and a {lateFee} VND late fee is added.',
        ],
      },
      {
        id: 'wallet',
        title: 'XXIV Wallet',
        items: [
          'You can top up with VNPay or MoMo, from {minTopUp} VND and up to {maxTopUp} VND per calendar day.',
          'Your wallet can pay deposits and parking fees. Refunds and compensation are paid into it.',
          'You can ask to withdraw your balance from the wallet screen.',
        ],
      },
      {
        id: 'lost-ticket',
        title: 'Lost tickets',
        items: [
          'Tell the staff at the lot and provide your Citizen ID and vehicle registration certificate.',
          "If staff approve the case, the lot's lost ticket fine is added to your bill at check-out.",
          'If staff do not approve it, the vehicle stays in the lot until new papers are provided and approved.',
        ],
      },
      {
        id: 'booked-bay',
        title: 'If your booked bay is taken',
        items: [
          'We move your booking to a free bay of the same type, and your first time block is free.',
          "If no bay is free, your booking is cancelled, your deposit is refunded and compensation from the lot's price list is paid into your wallet.",
        ],
      },
      {
        id: 'at-the-lot',
        title: 'At the parking lot',
        items: [
          'Follow the signs and the instructions of the staff.',
          'Report any damage or loss to the staff before you leave, so the session records can be checked.',
          'A vehicle left for more than {abandonedDays} days may be treated as abandoned and handled by the lot.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to these terms',
        items: [
          'We may update these terms. The date at the top of this page shows the current version.',
          'If you keep using XXIV Parking after an update, the new terms apply to you.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'This policy explains what personal data XXIV Parking collects, why it is needed and how it is handled.',
    summary: [
      'We collect your account details, Citizen ID, vehicle papers, license plate, gate photos and payment history.',
      'We use them to verify vehicles, run the gates, charge fees and support you.',
      'Registration photos are deleted {documentDays} days after staff decide on them.',
      'Only staff with the vehicle verification permission can open those photos, and every view is logged.',
      'Payment and parking records are kept, even after an account is locked.',
    ],
    sections: [
      {
        id: 'data',
        title: 'Data we collect',
        items: [
          'Account: full name, email, phone number, Citizen ID number and password.',
          'Vehicle: license plate, type, brand, model, color, and photos of your Citizen ID and registration certificate.',
          'Parking: bookings, entry and exit times, lots and bays used, and photos taken by the gate cameras.',
          'Payment: deposits, fees, refunds, wallet transactions, and the bank details you give for a withdrawal.',
          'Location: your position, only when you open directions to a parking lot and allow it in your browser.',
          'Chat: the questions you ask the assistant.',
        ],
      },
      {
        id: 'purposes',
        title: 'How we use it',
        items: [
          'To create your account and let you sign in.',
          'To check that a vehicle belongs to you or that you may drive it.',
          'To recognize vehicles at the gate, open the barrier and record each parking session.',
          'To calculate fees, take payments, and pay refunds and compensation.',
          'To handle lost tickets, incidents and support requests.',
          'To send you notices about your bookings, vehicles and prices.',
        ],
      },
      {
        id: 'sharing',
        title: 'Services we share data with',
        items: [
          'VNPay and MoMo process your online payments. You enter your payment details on their pages.',
          'Google handles sign-in if you choose to continue with Google.',
          'Mapbox receives your position and destination to draw a driving route.',
          'Google Gemini receives the questions you ask the assistant. Please do not type personal details in the chat.',
          'Microsoft Azure hosts the system.',
        ],
      },
      {
        id: 'access',
        title: 'Who can see your data',
        items: [
          'Staff and Managers see the data they need for the parking lots assigned to them.',
          'Registration photos can only be opened with the vehicle verification permission, and every view is logged.',
          'Public pages and public live updates never show license plates.',
        ],
      },
      {
        id: 'security',
        title: 'How we protect it',
        items: [
          'Data is sent over an encrypted connection (TLS).',
          'Passwords are stored as hashes, not as readable text.',
          'Access to each screen and action depends on the role of the account.',
        ],
      },
      {
        id: 'retention',
        title: 'How long we keep it',
        items: [
          'Photos of vehicle papers: deleted {documentDays} days after staff approve or reject the registration. The result of the check is kept.',
          'Notifications: deleted {readNoticeDays} days after being read, or after {unreadNoticeDays} days if never read.',
          'Parking sessions, their gate photos and payment records: kept as business and financial records.',
          'Account details: kept while the account exists, including after it is locked.',
        ],
      },
      {
        id: 'browser',
        title: 'Data stored in your browser',
        items: [
          'Your browser keeps your sign-in, language and light or dark mode so you do not have to set them again.',
          'Your assistant conversation stays in the browser tab and is cleared when the tab closes.',
        ],
      },
      {
        id: 'rights',
        title: 'Your choices',
        items: [
          'You can view and update your details on your Profile page.',
          'You can ask for your account to be deleted from the Profile page, and withdraw the request while it is pending.',
          'An Admin handles the request by locking the account. Payment and parking records are not erased.',
          'To ask about your data, contact us using the details below.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to this policy',
        items: ['We may update this policy. The date at the top of this page shows the current version.'],
      },
    ],
  },
}
