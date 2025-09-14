declare module 'react-native-razorpay' {
  interface RazorpayOptions {
    key: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    prefill?: {
      email?: string;
      contact?: string;
      name?: string;
    };
    theme?: { color?: string };
  }
  export default class RazorpayCheckout {
    static open(options: RazorpayOptions): Promise<any>;
  }
}
