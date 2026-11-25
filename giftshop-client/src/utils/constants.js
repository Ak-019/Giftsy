// Mirrors config/constants.js on the server
export const OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Festival', 'Housewarming', 'Thank You', 'Other'];
export const RECIPIENTS = ['For Him', 'For Her', 'Kids', 'Couples', 'Parents', 'Friends', 'Colleagues'];
export const ORDER_FLOW = ['Placed', 'Packed', 'Shipped', 'Delivered'];
export const STATUS_TRANSITIONS = {
  Placed: ['Packed', 'Cancelled'],
  Packed: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Refund Pending', 'Refunded'];
export const BUDGETS = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 to ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 to ₹2,000', min: 1000, max: 2000 },
  { label: '₹2,000 and up', min: 2000, max: null },
];
// Each occasion gets a palette colour, like the stacked swatches on the home page
export const OCCASION_STYLE = {
  Birthday: { bg: '#5E3A4D', fg: '#F4E1D2' },
  Anniversary: { bg: '#C77486', fg: '#3B2430' },
  Wedding: { bg: '#F4E1D2', fg: '#5E3A4D' },
  Festival: { bg: '#A8B89A', fg: '#3B2430' },
  Housewarming: { bg: '#A7B0D6', fg: '#3B2430' },
  'Thank You': { bg: '#5E3A4D', fg: '#F4E1D2' },
  Other: { bg: '#C77486', fg: '#3B2430' },
};
export const STATUS_CHIP = {
  Placed: 'chip-lavender',
  Packed: 'chip-lavender',
  Shipped: 'chip-rose',
  Delivered: 'chip-sage',
  Cancelled: 'chip-muted',
  Pending: 'chip-rose',
  Paid: 'chip-sage',
  'Refund Pending': 'chip-rose',
  Refunded: 'chip-muted',
};

// Each recipient gets its own palette pairing. "For Him" leans on Plum and Sage so the shop doesn't
// feel only feminine; "For Her" uses Rosewood. `chip` is the class for match-reason chips.
export const RECIPIENT_STYLE = {
  'For Him': { bg: '#5E3A4D', fg: '#F4E1D2', accent: '#A8B89A', chip: 'chip-sage', line: "Wallets, gadgets and keepsakes he'll actually use." },
  'For Her': { bg: '#C77486', fg: '#2A1A23', accent: '#F4E1D2', chip: 'chip-rose', line: 'Candles, jewellery boxes and little luxuries she will love.' },
  Kids: { bg: '#A7B0D6', fg: '#3B2430', accent: '#C77486', chip: 'chip-lavender', line: 'Toys and art kits that make birthdays unforgettable.' },
  Couples: { bg: '#C77486', fg: '#2A1A23', accent: '#5E3A4D', chip: 'chip-rose', line: 'Personalised gifts for two, for anniversaries and weddings.' },
  Parents: { bg: '#A8B89A', fg: '#3B2430', accent: '#5E3A4D', chip: 'chip-sage', line: 'Thoughtful hampers and keepsakes to say thank you.' },
  Friends: { bg: '#A7B0D6', fg: '#3B2430', accent: '#5E3A4D', chip: 'chip-lavender', line: 'Fun, easy gifts for the people who get you.' },
  Colleagues: { bg: '#A8B89A', fg: '#3B2430', accent: '#5E3A4D', chip: 'chip-sage', line: 'Desk-friendly gifts that work for any office.' },
};
