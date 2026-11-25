// Demo catalogue. Photos are from Unsplash (free to use under the Unsplash License, no attribution required),
// served from Unsplash's image CDN at 800x800. Swap in your own product photos any time (admin > Products > Upload).
const unsplash = (id) => `https://images.unsplash.com/photo-${id}?w=800&h=800&fit=crop&q=80&auto=format`;

// Main photo first, on a light or plain background so the shop grid looks consistent.
// A second photo (where there's a good one) shows in the product-page gallery.
const PHOTOS = {
  'Personalised Photo Mug': ['1650959858546-d09833d5317b', '1616241673111-508b4662c707'],
  'Scented Candle Trio': ['1700075970245-da6b3fb3e237', '1572726729207-a78d6feb18d7'],
  'Handmade Chocolate Box': ['1481391319762-47dff72954d9', '1687795097254-f019f9d7fd17'],
  'Leather Wallet': ['1624538000860-24716b9050f2', '1579014134953-1580d7f123f3'],
  'Couple Name Keychain': ['1557688578-b075dda6fc2c', '1654166769323-94a7e714d7c2'],
  'Succulent Plant Set': ['1459156212016-c812468e2115', '1485955900006-10f4d324d411'],
  'Teddy Bear': ['1774464593573-d641812872ce', '1764425172258-5b74beb62541'],
  'Wooden Photo Frame': ['1646006409124-81deb1275459', '1582053628662-c65b0e0544e9'],
  'Festive Dry Fruit Hamper': ['1537817347545-6cbc2fd55943', '1543158181-1274e5362710'],
  'Bluetooth Speaker': ['1586078875290-c22eb791ad5d', '1582978571763-2d039e56f0c3'],
  'Handmade Greeting Card': ['1554894872-1a01c75f7513', '1680183718072-e9b55b649698'],
  'Velvet Jewellery Box': ['1780745167657-9144974347c4', '1549315309-f0857a904065'],
  'Kids Art Kit': ['1694390187432-25f23879c838', '1513542789411-b6a5d4f31634'],
  'Couple Caricature Print': ['1593472807861-5bb884af28f6', '1674643925879-d457c6e93801'],
  'Spa Gift Box': ['1577403349502-058e4a149b3f', '1783773465109-30a94863dbc2'],
  'Desk Organiser': ['1777917845221-f92884c1b61b'],
};

// [name, description, price, discountPrice, category, occasions, recipients, stock, variants, featured]
const rows = [
  ['Personalised Photo Mug', 'Ceramic 330 ml mug printed with your favourite photo and a short message. Dishwasher safe.', 399, 349, 'Mugs', ['Birthday', 'Anniversary', 'Thank You'], ['For Him', 'For Her', 'Friends'], 40, [], true],
  ['Scented Candle Trio', 'Three hand-poured soy candles: lavender, vanilla and sandalwood. About 25 hours each.', 799, 699, 'Home Decor', ['Housewarming', 'Festival', 'Thank You'], ['For Her', 'Parents', 'Colleagues'], 25, [], true],
  ['Handmade Chocolate Box', 'Assorted artisan chocolates with nuts, caramel and fruit fillings.', 899, null, 'Food', ['Birthday', 'Festival', 'Anniversary'], ['For Her', 'Kids', 'Friends'], 30, [{ name: '16 pieces', priceDelta: 0 }, { name: '24 pieces', priceDelta: 350 }], true],
  ['Leather Wallet', 'Slim genuine leather wallet with RFID protection and six card slots.', 1499, 1299, 'Accessories', ['Birthday', 'Anniversary'], ['For Him'], 15, [{ name: 'Brown', priceDelta: 0 }, { name: 'Black', priceDelta: 0 }], true],
  ['Couple Name Keychain', 'Pair of wooden keychains engraved with two names and a date.', 249, null, 'Accessories', ['Anniversary', 'Wedding'], ['Couples'], 60, [], false],
  ['Succulent Plant Set', 'Three easy-care mini succulents in matte ceramic pots.', 549, null, 'Plants', ['Housewarming', 'Birthday', 'Thank You'], ['For Her', 'For Him', 'Colleagues'], 20, [], true],
  ['Teddy Bear', 'Super-soft plush teddy bear with a satin bow.', 999, 849, 'Toys', ['Birthday', 'Anniversary'], ['Kids', 'For Her'], 12, [{ name: '30 cm', priceDelta: -300 }, { name: '60 cm', priceDelta: 0 }, { name: '90 cm', priceDelta: 600 }], false],
  ['Wooden Photo Frame', 'Hand-finished teak frame for an 8x10 inch photo, with optional engraving.', 479, null, 'Home Decor', ['Wedding', 'Anniversary', 'Housewarming'], ['Couples', 'Parents'], 35, [], false],
  ['Festive Dry Fruit Hamper', 'Premium almonds, cashews, pistachios, raisins and dates in a reusable wooden box.', 1699, 1499, 'Food', ['Festival', 'Wedding', 'Thank You'], ['Parents', 'Colleagues', 'For Him', 'For Her'], 18, [], true],
  ['Bluetooth Speaker', 'Pocket-sized waterproof speaker with 8 hours of playtime.', 1799, null, 'Gadgets', ['Birthday'], ['For Him', 'Friends'], 10, [{ name: 'Black', priceDelta: 0 }, { name: 'Blue', priceDelta: 0 }], false],
  ['Handmade Greeting Card', 'Pop-up card with a blank inside for your own message.', 149, null, 'Cards', ['Birthday', 'Anniversary', 'Wedding', 'Thank You'], ['For Him', 'For Her', 'Kids', 'Friends'], 100, [], false],
  ['Velvet Jewellery Box', 'Velvet-lined wooden organiser with a mirror and two drawers.', 1099, null, 'Accessories', ['Wedding', 'Anniversary', 'Birthday'], ['For Her'], 3, [], false],
  ['Kids Art Kit', '150-piece art set with crayons, sketch pens and watercolours in a carry case.', 699, 599, 'Toys', ['Birthday', 'Festival'], ['Kids'], 22, [], false],
  ['Couple Caricature Print', 'Hand-drawn digital caricature of two people from your photo, printed and framed.', 1299, null, 'Personalised', ['Anniversary', 'Wedding'], ['Couples'], 8, [{ name: 'A4', priceDelta: 0 }, { name: 'A3', priceDelta: 400 }], true],
  ['Spa Gift Box', 'Bath salts, body butter, a loofah and a scented candle for a relaxing evening.', 1199, null, 'Wellness', ['Birthday', 'Thank You', 'Festival'], ['For Her', 'Parents'], 14, [], false],
  ['Desk Organiser', 'Bamboo desk organiser with a phone stand and pen holder.', 649, null, 'Home Decor', ['Thank You', 'Housewarming'], ['Colleagues', 'For Him'], 4, [], false],
];

module.exports = rows.map(([name, description, price, discountPrice, category, occasions, recipients, stock, variants, isFeatured]) => ({
  name, description, price, discountPrice, category, occasions, recipients, stock, variants, isFeatured,
  images: (PHOTOS[name] || []).map(unsplash),
}));
