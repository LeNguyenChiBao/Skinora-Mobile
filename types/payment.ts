export interface PaymentResponse {
  data: {
    paymentUrl: string;
    orderCode: string;
  };
  success: boolean;
  message?: string;
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
