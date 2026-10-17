package com.societycart;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.web.client.RestClient;

/** Gateway adapter. Kept unregistered until payment lifecycle reconciliation is implemented. */
public final class RazorpayPaymentService implements PaymentService {
  private final RestClient client;
  private final String keySecret, webhookSecret;

  public RazorpayPaymentService(String keyId, String keySecret, String webhookSecret) {
    if (keyId.isBlank() || keySecret.isBlank() || webhookSecret.isBlank())
      throw new IllegalArgumentException("Razorpay configuration is incomplete");
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    client =
        RestClient.builder()
            .baseUrl("https://api.razorpay.com/v1")
            .defaultHeaders(h -> h.setBasicAuth(keyId, keySecret))
            .build();
  }

  public String name() {
    return "RAZORPAY";
  }

  public void confirm(boolean success) {
    throw new UnsupportedOperationException("Use verified gateway capture, never simulation");
  }

  public void refund() {
    throw new UnsupportedOperationException("A gateway payment ID and amount are required");
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> createOrder(UUID orderId, long amountPaise) {
    if (amountPaise <= 0) throw new IllegalArgumentException("Invalid payment amount");
    return client
        .post()
        .uri("/orders")
        .body(Map.of("amount", amountPaise, "currency", "INR", "receipt", orderId.toString()))
        .retrieve()
        .body(Map.class);
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> fetchPayment(String paymentId) {
    checkId(paymentId);
    return client.get().uri("/payments/{id}", paymentId).retrieve().body(Map.class);
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> requestRefund(String paymentId, long amountPaise, String receipt) {
    checkId(paymentId);
    return client
        .post()
        .uri("/payments/{id}/refund", paymentId)
        .body(Map.of("amount", amountPaise, "receipt", receipt))
        .retrieve()
        .body(Map.class);
  }

  public boolean verifyCallback(String gatewayOrder, String paymentId, String signature) {
    return signatureMatches(
        (gatewayOrder + "|" + paymentId).getBytes(StandardCharsets.UTF_8), keySecret, signature);
  }

  public boolean verifyWebhook(byte[] rawBody, String signature) {
    return signatureMatches(rawBody, webhookSecret, signature);
  }

  static boolean signatureMatches(byte[] body, String secret, String signature) {
    if (signature == null || !signature.matches("[0-9a-fA-F]{64}")) return false;
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return MessageDigest.isEqual(mac.doFinal(body), HexFormat.of().parseHex(signature));
    } catch (java.security.GeneralSecurityException e) {
      throw new IllegalStateException("HMAC unavailable", e);
    }
  }

  private void checkId(String id) {
    if (id == null || !id.matches("pay_[A-Za-z0-9]+"))
      throw new IllegalArgumentException("Invalid gateway payment ID");
  }
}
