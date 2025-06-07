export interface SubscriptionPlan {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  aiUsageAmount: number;
  meetingAmount: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface SubscriptionPlansResponse {
  success: boolean;
  data: SubscriptionPlan[];
  message: string;
}
