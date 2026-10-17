package com.societycart;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class GatewaySignatureTest {
  @Test
  void verifiesHmacAndRejectsTampering() {
    byte[] body = "The quick brown fox jumps over the lazy dog".getBytes(StandardCharsets.UTF_8);
    String signature = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";
    assertTrue(RazorpayPaymentService.signatureMatches(body, "key", signature));
    assertFalse(
        RazorpayPaymentService.signatureMatches(
            "changed".getBytes(StandardCharsets.UTF_8), "key", signature));
    assertFalse(RazorpayPaymentService.signatureMatches(body, "key", "invalid"));
  }
}
