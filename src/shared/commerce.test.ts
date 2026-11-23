import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDiscountPercent,
  computeCartTotals,
  getTrackingStageIndex,
  isSafeImageUrl,
  validateAndComputeOffer,
  type Offer,
} from './commerce';

const samplePercentOffer: Offer = {
  id: 1,
  code: 'MURT15',
  title: '15% Welcome Offer',
  description: 'Save 15% up to ₹1,500',
  discountType: 'percent',
  discountValue: 15,
  maxDiscount: 1500,
  minOrderAmount: 999,
  isActive: true,
  expiresAt: '2099-12-31T23:59:59Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const sampleFlatOffer: Offer = {
  id: 2,
  code: 'FLAT500',
  title: 'Flat ₹500 Off',
  description: 'Instant ₹500 off above ₹2,999',
  discountType: 'flat',
  discountValue: 500,
  maxDiscount: 500,
  minOrderAmount: 2999,
  isActive: true,
  expiresAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

test('calculateDiscountPercent computes accurate percentage and guards edge cases', () => {
  assert.equal(calculateDiscountPercent(10000, 7500), 25);
  assert.equal(calculateDiscountPercent(2000, 2000), 0);
  assert.equal(calculateDiscountPercent(0, 500), 0);
});

test('validateAndComputeOffer enforces minimum order, percentage cap, and active state', () => {
  const now = new Date('2026-11-23T00:00:00Z');
  const belowMin = validateAndComputeOffer(800, samplePercentOffer, now);
  assert.equal(belowMin.valid, false);
  assert.equal(belowMin.discountAmount, 0);

  const capped = validateAndComputeOffer(20000, samplePercentOffer, now);
  assert.equal(capped.valid, true);
  assert.equal(capped.discountAmount, 1500);

  const inactive = validateAndComputeOffer(5000, { ...samplePercentOffer, isActive: false }, now);
  assert.equal(inactive.valid, false);

  const expired = validateAndComputeOffer(
    5000,
    { ...samplePercentOffer, expiresAt: '2020-01-01T00:00:00Z' },
    now
  );
  assert.equal(expired.valid, false);
});

test('computeCartTotals calculates product savings, coupon discount, and delivery fee threshold', () => {
  const lowCart = computeCartTotals([{ price: 500, mrp: 800, quantity: 1 }]);
  assert.equal(lowCart.subtotal, 500);
  assert.equal(lowCart.productSavings, 300);
  assert.equal(lowCart.deliveryFee, 79);
  assert.equal(lowCart.grandTotal, 579);

  const highCartWithFlat = computeCartTotals(
    [{ price: 3200, mrp: 4000, quantity: 1 }],
    sampleFlatOffer
  );
  assert.equal(highCartWithFlat.couponDiscount, 500);
  assert.equal(highCartWithFlat.deliveryFee, 0);
  assert.equal(highCartWithFlat.grandTotal, 2700);
});

test('getTrackingStageIndex returns ordered Flipkart-style stage indices', () => {
  assert.equal(getTrackingStageIndex('Order Placed'), 0);
  assert.equal(getTrackingStageIndex('Packed'), 1);
  assert.equal(getTrackingStageIndex('In Transit'), 2);
  assert.equal(getTrackingStageIndex('Out for Delivery'), 3);
  assert.equal(getTrackingStageIndex('Delivered'), 4);
  assert.equal(getTrackingStageIndex('Cancelled'), -1);
});

test('isSafeImageUrl permits local assets, https, base64 images and rejects javascript/unsafe URIs', () => {
  assert.equal(isSafeImageUrl('/src/assets/images/prod_headphones.jpg'), true);
  assert.equal(isSafeImageUrl('/api/default-qr.svg'), true);
  assert.equal(isSafeImageUrl('https://example.com/qr.png'), true);
  assert.equal(isSafeImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(isSafeImageUrl('/src/assets/../secret.txt'), false);
});
