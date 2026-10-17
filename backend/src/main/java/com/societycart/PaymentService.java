package com.societycart;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.*;

public interface PaymentService {
  String name();

  void confirm(boolean success);

  void refund();
}

@Configuration
class PaymentConfiguration {
  @Bean
  @ConditionalOnProperty(
      name = "app.payment-provider",
      havingValue = "simulated",
      matchIfMissing = true)
  PaymentService simulated(@Value("${app.demo}") boolean demo) {
    if (!demo)
      throw new IllegalStateException(
          "Simulated payments require DEMO_MODE=true. Never enable in production.");
    return new SimulatedPaymentService();
  }

  @Bean
  @ConditionalOnProperty(name = "app.payment-provider", havingValue = "razorpay")
  PaymentService razorpay() {
    throw new IllegalStateException(
        "Razorpay is not enabled: gateway verification and reconciliation require implementation"
            + " before real payments.");
  }
}

class SimulatedPaymentService implements PaymentService {
  public String name() {
    return "SIMULATED";
  }

  public void confirm(boolean success) {}

  public void refund() {}
}
