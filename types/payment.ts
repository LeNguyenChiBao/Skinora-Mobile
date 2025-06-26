export interface PaymentResponse {
  paymentId: string;
  amount: number;
  description: string;
  subscriptionId: string;
  orderCode: string;
  bankAccount: string;
  bankName: string;
  accountName: string;
  transferContent: string;
}

export interface PaymentStatusResponse {
  data: {
    status: "completed" | "paid" | "failed" | "cancelled";
    orderCode: string;
    amount?: number;
    subscriptionId?: string;
  };
  success: boolean;
  message?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  features: string[];
}

export type NavigationParams = {
  Home: undefined;
  PaymentSuccess: { orderCode: string };
  PaymentCancel: undefined;
};
