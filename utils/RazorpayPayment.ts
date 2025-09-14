import RazorpayCheckout from 'react-native-razorpay';
import { getConfig } from './Config';

export interface RazorpayOptions {
  amount: number; // Amount in paisa
  currency?: string;
  description?: string;
  name?: string;
  prefill?: {
    email?: string;
    contact?: string;
    name?: string;
  };
}

export function openRazorpay(options: RazorpayOptions): Promise<any> {
  const config = getConfig();
  return new Promise((resolve, reject) => {
    const paymentOptions = {
      key: config.razorpay.keyId,
      amount: options.amount,
      currency: options.currency || 'INR',
      name: options.name || 'Chatwithpdf',
      description: options.description || 'Subscription Payment',
      prefill: options.prefill || {},
      theme: { color: '#4CAF50' },
    };
    RazorpayCheckout.open(paymentOptions)
      .then(resolve)
      .catch(reject);
  });
}
