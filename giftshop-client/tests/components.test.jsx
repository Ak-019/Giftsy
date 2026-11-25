import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StatusTimeline from '../src/components/StatusTimeline';
import AddressForm, { validateAddress } from '../src/components/AddressForm';
import { Price, StockNote } from '../src/components/ui';

describe('StatusTimeline', () => {
  test('shows all four steps for a shipped order', () => {
    render(<StatusTimeline order={{ status: 'Shipped', statusHistory: [{ status: 'Placed', at: new Date() }, { status: 'Packed', at: new Date() }, { status: 'Shipped', at: new Date() }] }} />);
    ['Placed', 'Packed', 'Shipped', 'Delivered'].forEach((s) => expect(screen.getByText(s)).toBeInTheDocument());
  });
  test('a cancelled order ends with Cancelled and skips steps that never happened', () => {
    render(<StatusTimeline order={{ status: 'Cancelled', statusHistory: [{ status: 'Placed', at: new Date() }, { status: 'Cancelled', at: new Date() }] }} />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
  });
});

describe('AddressForm', () => {
  test('validation matches the API rules', () => {
    expect(validateAddress({ fullName: 'A B', phone: '9876543210', line1: '12 Road', city: 'Pune', state: 'MH', pincode: '411001' })).toEqual({});
    expect(Object.keys(validateAddress({ fullName: '', phone: '12345', line1: '', city: '', state: '', pincode: '1' })).sort())
      .toEqual(['city', 'fullName', 'line1', 'phone', 'pincode', 'state']);
  });
  test('does not submit an invalid address and shows the errors', async () => {
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter a 10-digit mobile number')).toBeInTheDocument();
  });
});

test('Price shows the discount and StockNote the stock level', () => {
  render(<><Price price={1000} finalPrice={800} /><StockNote stock={3} /><StockNote stock={0} /></>);
  expect(screen.getByText('20% off')).toBeInTheDocument();
  expect(screen.getByText('Only 3 left')).toBeInTheDocument();
  expect(screen.getByText('Out of stock')).toBeInTheDocument();
});
