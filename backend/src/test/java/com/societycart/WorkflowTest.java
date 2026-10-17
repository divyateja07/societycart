package com.societycart;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.*;

@SpringBootTest
@AutoConfigureMockMvc
class WorkflowTest {
  @Autowired Api service;
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate db;
  @Autowired ObjectMapper json;
  @Autowired PasswordEncoder encoder;
  MockHttpSession customer, admin;
  UUID user, society, product, supplier, cycle;
  String email;

  @BeforeEach
  void setup() throws Exception {
    ((Api) org.springframework.test.util.AopTestUtils.getTargetObject(service)).attempts.clear();
    String suffix = UUID.randomUUID().toString();
    email = suffix + "@example.test";
    call(
        "POST",
        "/auth/register",
        null,
        Map.of("name", "Test neighbour", "email", email, "password", "Test-neighbour-123"),
        201);
    customer = login(email, "Test-neighbour-123");
    user = db.queryForObject("select id from users where email=?", UUID.class, email);
    String ae = "admin-" + suffix + "@example.test";
    db.update(
        "insert into users(name,email,password,role) values('Test admin',?,?,'ADMIN')",
        ae,
        encoder.encode("Test-administrator-123"));
    admin = login(ae, "Test-administrator-123");
    society =
        UUID.fromString(
            call(
                    "POST",
                    "/admin/societies",
                    admin,
                    Map.of("name", "Test society " + suffix, "location", "Pune", "active", true),
                    200)
                .get("id")
                .asText());
    UUID cat = db.queryForObject("select id from categories limit 1", UUID.class);
    product = UUID.randomUUID();
    supplier = UUID.randomUUID();
    db.update(
        "insert into products(id,category_id,name,brand,pack_size) values(?,?,'Test rice','Test','1"
            + " kg')",
        product,
        cat);
    db.update(
        "insert into suppliers(id,name,email) values(?,'Test supplier','test@example.test')",
        supplier);
    cycle = makeCycle(10000);
  }

  UUID makeCycle(long minimum) {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into buying_cycles(id,society_id,name,starts_at,cutoff_at,minimum_paise)"
            + " values(?,?,'Test cycle',now()-interval '1 hour',now()+interval '1 day',?)",
        id,
        society,
        minimum);
    db.update(
        "insert into"
            + " cycle_product_prices(cycle_id,product_id,supplier_id,price_paise,reference_paise,cost_paise,reference_source,stock)"
            + " values(?,?,?,10000,12000,8000,'Test fixture',10)",
        id,
        product,
        supplier);
    return id;
  }

  MockHttpSession login(String email, String password) throws Exception {
    return (MockHttpSession)
        mvc.perform(
                post("/api/v1/auth/login")
                    .with(csrf())
                    .contentType("application/json")
                    .content(json.writeValueAsString(Map.of("email", email, "password", password))))
            .andReturn()
            .getRequest()
            .getSession(false);
  }

  JsonNode call(String method, String path, MockHttpSession session, Object body, int expected)
      throws Exception {
    var req =
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(
                org.springframework.http.HttpMethod.valueOf(method), "/api/v1" + path)
            .with(csrf());
    if (session != null) req.session(session);
    if (body != null) req.contentType("application/json").content(json.writeValueAsString(body));
    var response = mvc.perform(req).andReturn().getResponse();
    assertEquals(expected, response.getStatus(), response.getContentAsString());
    return response.getContentAsString().isBlank()
        ? json.nullNode()
        : json.readTree(response.getContentAsString());
  }

  void approve() throws Exception {
    call("POST", "/memberships", customer, Map.of("societyId", society, "flat", "A-204"), 200);
    UUID id =
        db.queryForObject(
            "select id from society_memberships where user_id=? and society_id=?",
            UUID.class,
            user,
            society);
    call("PATCH", "/admin/memberships/" + id, admin, Map.of("status", "APPROVED"), 200);
  }

  Map<String, Object> basket(String key, int qty) {
    return Map.of(
        "cycleId",
        cycle,
        "items",
        List.of(Map.of("productId", product, "quantity", qty)),
        "idempotencyKey",
        key,
        "method",
        "COLLECTION");
  }

  UUID order(int quantity) throws Exception {
    return UUID.fromString(
        call("POST", "/orders", customer, basket(UUID.randomUUID().toString(), quantity), 200)
            .get("id")
            .asText());
  }

  void pay(UUID id, boolean success) throws Exception {
    call("POST", "/payments/simulate", customer, Map.of("orderId", id, "success", success), 200);
  }

  @Test
  void registrationHashAndAuthorization() throws Exception {
    String hash = db.queryForObject("select password from users where id=?", String.class, user);
    assertNotEquals("Test-neighbour-123", hash);
    assertTrue(encoder.matches("Test-neighbour-123", hash));
    call("GET", "/admin/dashboard", customer, null, 403);
    call("GET", "/auth/me", customer, null, 200);
    call(
        "POST", "/auth/login", null, Map.of("email", email, "password", "incorrect-password"), 400);
  }

  @Test
  void membershipGateAndRejection() throws Exception {
    call("POST", "/orders", customer, basket("unapproved", 1), 403);
    call("POST", "/memberships", customer, Map.of("societyId", society, "flat", "B-1"), 200);
    UUID id =
        db.queryForObject("select id from society_memberships where user_id=?", UUID.class, user);
    call("PATCH", "/admin/memberships/" + id, admin, Map.of("status", "REJECTED"), 200);
    call("POST", "/orders", customer, basket("rejected", 1), 403);
  }

  @Test
  void checkoutSnapshotsAndIdempotency() throws Exception {
    approve();
    var body = basket("same-key", 2);
    var first = call("POST", "/orders", customer, body, 200);
    var second = call("POST", "/orders", customer, body, 200);
    assertEquals(first.get("id"), second.get("id"));
    assertEquals(20000, first.get("total_paise").asLong());
    assertEquals(4000, first.get("savings_paise").asLong());
    call("POST", "/orders", customer, basket("same-key", 3), 409);
    assertEquals(
        8,
        db.queryForObject(
            "select stock from cycle_product_prices where cycle_id=?", Integer.class, cycle));
  }

  @Test
  void paymentAggregationProcurementAndFulfillment() throws Exception {
    approve();
    UUID first = order(2), second = order(1);
    pay(first, true);
    pay(first, true);
    pay(second, true);
    call("POST", "/admin/cycles/" + cycle + "/close", admin, null, 200);
    call("POST", "/admin/cycles/" + cycle + "/close", admin, null, 200);
    assertEquals(
        3,
        db.queryForObject(
            "select sum(i.quantity) from supplier_order_items i join supplier_orders s on"
                + " s.id=i.supplier_order_id where s.cycle_id=?",
            Integer.class,
            cycle));
    UUID fid = db.queryForObject("select id from fulfillments where order_id=?", UUID.class, first);
    call("PATCH", "/admin/fulfillments/" + fid, admin, Map.of("status", "DELIVERED"), 400);
    call("PATCH", "/admin/fulfillments/" + fid, admin, Map.of("status", "SUPPLIER_CONFIRMED"), 200);
    assertTrue(
        call("GET", "/orders/me", customer, null, 200).toString().contains("SUPPLIER_CONFIRMED"));
  }

  @Test
  void insufficientGroupRefundsOnlyPaidOrders() throws Exception {
    approve();
    db.update("update buying_cycles set minimum_paise=999999 where id=?", cycle);
    UUID paid = order(1), pending = order(1);
    pay(paid, true);
    call("POST", "/admin/cycles/" + cycle + "/close", admin, null, 200);
    assertEquals(
        "REFUNDED", db.queryForObject("select status from orders where id=?", String.class, paid));
    assertEquals(
        "CANCELLED",
        db.queryForObject("select status from orders where id=?", String.class, pending));
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from refunds r join payments p on p.id=r.payment_id where"
                + " p.order_id=?",
            Integer.class,
            paid));
    assertEquals(
        10,
        db.queryForObject(
            "select stock from cycle_product_prices where cycle_id=?", Integer.class, cycle));
  }

  @Test
  void failedPaymentReleasesStockAndCannotBecomePaid() throws Exception {
    approve();
    UUID id = order(3);
    pay(id, false);
    pay(id, true);
    assertEquals(
        "FAILED",
        db.queryForObject("select status from payments where order_id=?", String.class, id));
    assertEquals(
        10,
        db.queryForObject(
            "select stock from cycle_product_prices where cycle_id=?", Integer.class, cycle));
  }

  @Test
  void expiredCycleAndStockRejected() throws Exception {
    approve();
    call("POST", "/orders", customer, basket("too-many", 11), 400);
    db.update("update buying_cycles set cutoff_at=now()-interval '1 minute' where id=?", cycle);
    call("POST", "/orders", customer, basket("late", 1), 400);
  }

  @Test
  void crossCustomerOrderHidden() throws Exception {
    approve();
    UUID id = order(1);
    call("GET", "/orders/" + id, admin, null, 404);
  }

  @Test
  void csrfRequired() throws Exception {
    assertEquals(
        403,
        mvc.perform(
                post("/api/v1/orders")
                    .session(customer)
                    .contentType("application/json")
                    .content(json.writeValueAsString(basket("no-csrf", 1))))
            .andReturn()
            .getResponse()
            .getStatus());
  }

  @Test
  void concurrentCheckoutCannotOversell() throws Exception {
    approve();
    var pool = Executors.newFixedThreadPool(2);
    try {
      Callable<Integer> action =
          () -> {
            var req =
                post("/api/v1/orders")
                    .session(customer)
                    .with(csrf())
                    .contentType("application/json")
                    .content(json.writeValueAsString(basket(UUID.randomUUID().toString(), 7)));
            return mvc.perform(req).andReturn().getResponse().getStatus();
          };
      var results = pool.invokeAll(List.of(action, action));
      var statuses = List.of(results.get(0).get(), results.get(1).get());
      assertTrue(statuses.contains(200));
      assertTrue(statuses.contains(400));
      assertEquals(
          3,
          db.queryForObject(
              "select stock from cycle_product_prices where cycle_id=?", Integer.class, cycle));
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void deliveryUsesDeliveryState() throws Exception {
    approve();
    var body = new HashMap<String, Object>(basket(UUID.randomUUID().toString(), 1));
    body.put("method", "DELIVERY");
    UUID id = UUID.fromString(call("POST", "/orders", customer, body, 200).get("id").asText());
    pay(id, true);
    call("POST", "/admin/cycles/" + cycle + "/close", admin, null, 200);
    UUID fid = db.queryForObject("select id from fulfillments where order_id=?", UUID.class, id);
    for (String state : List.of("SUPPLIER_CONFIRMED", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"))
      call("PATCH", "/admin/fulfillments/" + fid, admin, Map.of("status", state), 200);
  }
}
