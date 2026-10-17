package com.societycart;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.*;
import org.springframework.security.core.*;
import org.springframework.security.core.context.*;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class Api {
  final JdbcTemplate db;
  final PasswordEncoder encoder;
  final UserDetailsService users;
  final PaymentService payments;

  Api(JdbcTemplate db, PasswordEncoder encoder, UserDetailsService users, PaymentService payments) {
    this.db = db;
    this.encoder = encoder;
    this.users = users;
    this.payments = payments;
  }

  static ResponseStatusException bad(String s) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, s);
  }

  Map<String, Object> one(String sql, Object... args) {
    var r = db.queryForList(sql, args);
    if (r.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
    return r.getFirst();
  }

  UUID uid(Authentication a) {
    return (UUID) one("select id from users where email=?", a.getName()).get("id");
  }

  void member(UUID user, UUID society) {
    if (db.queryForObject(
            "select count(*) from society_memberships where user_id=? and society_id=? and"
                + " status='APPROVED'",
            Long.class,
            user,
            society)
        == 0)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Approved membership required");
  }

  void audit(Authentication a, String action, UUID target) {
    db.update(
        "insert into audit_logs(actor_id,action,target_id) values(?,?,?)", uid(a), action, target);
  }

  record Registration(
      @NotBlank @Size(max = 100) String name,
      @Email @NotBlank @Size(max = 200) String email,
      @NotBlank @Size(min = 10, max = 72) String password) {}

  record Login(@Email @NotBlank String email, @NotBlank String password) {}

  record Membership(@NotNull UUID societyId, @NotBlank @Size(max = 30) String flat) {}

  record Item(@NotNull UUID productId, @Min(1) @Max(100) int quantity) {}

  record Checkout(
      @NotNull UUID cycleId,
      @NotEmpty @Size(max = 100) List<@Valid Item> items,
      @NotBlank @Size(max = 100) String idempotencyKey,
      @Pattern(regexp = "COLLECTION|DELIVERY") @NotNull String method) {}

  record Simulation(@NotNull UUID orderId, boolean success) {}

  record Status(@NotBlank String status) {}

  record Society(@NotBlank String name, @NotBlank String location, boolean active) {}

  record Product(
      @NotNull UUID categoryId,
      @NotBlank String name,
      @NotBlank String brand,
      @NotBlank String packSize,
      @NotBlank String image,
      boolean active) {}

  record Supplier(@NotBlank String name, @Email @NotBlank String email) {}

  record Price(
      @NotNull UUID productId,
      @NotNull UUID supplierId,
      @Min(1) @Max(1000000000000L) long pricePaise,
      @Min(1) @Max(1000000000000L) long referencePaise,
      @Min(0) @Max(1000000000000L) long costPaise,
      @Min(0) int stock,
      @NotBlank String referenceSource) {}

  record Cycle(
      @NotNull UUID societyId,
      @NotBlank String name,
      @NotNull Instant startsAt,
      @NotNull Instant cutoffAt,
      @Min(0) long minimumPaise,
      @NotEmpty List<@Valid Price> prices) {}

  final Map<String, long[]> attempts = new ConcurrentHashMap<>();

  void limit(HttpServletRequest r) {
    long now = System.currentTimeMillis();
    attempts.entrySet().removeIf(e -> now - e.getValue()[0] > 60000);
    var v = attempts.computeIfAbsent(r.getRemoteAddr(), k -> new long[] {now, 0});
    synchronized (v) {
      if (++v[1] > 20)
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Try again in a minute");
    }
  }

  @GetMapping("/auth/csrf")
  Object csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  Object register(@Valid @RequestBody Registration r, HttpServletRequest req) {
    limit(req);
    if (r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw bad("Password must be at most 72 UTF-8 bytes");
    if (db.queryForObject(
            "select count(*) from users where email=?",
            Long.class,
            r.email().toLowerCase(Locale.ROOT))
        > 0) throw bad("Email already registered");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into users(id,name,email,password,role) values(?,?,?,?,'CUSTOMER')",
        id,
        r.name(),
        r.email().toLowerCase(Locale.ROOT),
        encoder.encode(r.password()));
    return Map.of("id", id);
  }

  @PostMapping("/auth/login")
  Object login(@Valid @RequestBody Login r, HttpServletRequest req, HttpServletResponse res) {
    limit(req);
    try {
      var u = users.loadUserByUsername(r.email());
      if (!encoder.matches(r.password(), u.getPassword())) throw bad("Invalid credentials");
      var auth = UsernamePasswordAuthenticationToken.authenticated(u, null, u.getAuthorities());
      if (req.getSession(false) != null) req.changeSessionId();
      var context = SecurityContextHolder.createEmptyContext();
      context.setAuthentication(auth);
      SecurityContextHolder.setContext(context);
      new HttpSessionSecurityContextRepository().saveContext(context, req, res);
      return me(auth);
    } catch (org.springframework.security.core.userdetails.UsernameNotFoundException ex) {
      throw bad("Invalid credentials");
    }
  }

  @PostMapping("/auth/logout")
  Object logout(HttpServletRequest r) {
    if (r.getSession(false) != null) r.getSession().invalidate();
    SecurityContextHolder.clearContext();
    return Map.of("ok", true);
  }

  @GetMapping("/auth/me")
  Object me(Authentication a) {
    if (a == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    return one("select id,name,email,role from users where id=?", uid(a));
  }

  @GetMapping("/societies")
  Object societies(@RequestParam(defaultValue = "") String search) {
    return db.queryForList(
        "select * from societies where active and name ilike ? order by name limit 100",
        "%" + search + "%");
  }

  @GetMapping("/societies/{id}")
  Object society(@PathVariable UUID id) {
    return one("select * from societies where id=? and active", id);
  }

  @PostMapping("/memberships")
  Object join(Authentication a, @Valid @RequestBody Membership m) {
    one("select id from societies where id=? and active", m.societyId());
    db.update(
        "insert into society_memberships(user_id,society_id,flat,status) values(?,?,?,'PENDING') on"
            + " conflict(user_id,society_id) do nothing",
        uid(a),
        m.societyId(),
        m.flat());
    return memberships(a);
  }

  @GetMapping("/memberships/me")
  Object memberships(Authentication a) {
    return db.queryForList(
        "select m.*,s.name society_name from society_memberships m join societies s on"
            + " s.id=m.society_id where user_id=?",
        uid(a));
  }

  @GetMapping("/categories")
  Object categories() {
    return db.queryForList("select * from categories order by name");
  }

  @GetMapping("/products")
  Object products(@RequestParam(defaultValue = "") String search) {
    return db.queryForList(
        "select p.*,c.name category from products p join categories c on c.id=p.category_id where"
            + " p.active and p.name ilike ? order by p.name limit 100",
        "%" + search + "%");
  }

  @GetMapping("/products/{id}")
  Object product(@PathVariable UUID id) {
    return one("select * from products where id=? and active", id);
  }

  @GetMapping("/cycles/active")
  Object cycles(Authentication a) {
    return db.queryForList(
        "select c.*,s.name society_name,coalesce((select sum(total_paise) from orders o where"
            + " o.cycle_id=c.id and o.status='PAID'),0) paid_paise from buying_cycles c join"
            + " societies s on s.id=c.society_id where s.active and c.status='OPEN' and"
            + " c.starts_at<=now() and c.cutoff_at>now() and exists(select 1 from"
            + " society_memberships m where m.society_id=c.society_id and m.user_id=? and"
            + " m.status='APPROVED') order by c.cutoff_at",
        uid(a));
  }

  @GetMapping("/cycles/{id}")
  Object cycle(Authentication a, @PathVariable UUID id) {
    var c = one("select * from buying_cycles where id=?", id);
    member(uid(a), (UUID) c.get("society_id"));
    return Map.of(
        "cycle",
        c,
        "products",
        db.queryForList(
            "select p.*,cp.price_paise,cp.reference_paise,cp.reference_source,cp.stock,c.name"
                + " category from cycle_product_prices cp join products p on p.id=cp.product_id"
                + " join categories c on c.id=p.category_id where cp.cycle_id=? and p.active order"
                + " by p.name",
            id));
  }

  @GetMapping("/cycles/{id}/progress")
  Object progress(Authentication a, @PathVariable UUID id) {
    var c = one("select * from buying_cycles where id=?", id);
    member(uid(a), (UUID) c.get("society_id"));
    return one(
        "select count(*) orders,coalesce(sum(total_paise),0) paid_paise from orders where"
            + " cycle_id=? and status='PAID'",
        id);
  }

  @PostMapping("/orders")
  @Transactional
  Object checkout(Authentication a, @Valid @RequestBody Checkout r) {
    UUID user = uid(a);
    var c = one("select * from buying_cycles where id=? for update", r.cycleId());
    var existing =
        db.queryForList(
            "select * from orders where user_id=? and idempotency_key=?", user, r.idempotencyKey());
    if (!existing.isEmpty()) {
      var saved = existing.getFirst();
      var requested =
          r.items().stream().map(i -> i.productId() + ":" + i.quantity()).sorted().toList();
      var stored =
          db
              .queryForList(
                  "select product_id,quantity from order_items where order_id=?", saved.get("id"))
              .stream()
              .map(i -> i.get("product_id") + ":" + i.get("quantity"))
              .sorted()
              .toList();
      if (!saved.get("cycle_id").equals(r.cycleId())
          || !saved.get("method").equals(r.method())
          || !requested.equals(stored))
        throw new ResponseStatusException(
            HttpStatus.CONFLICT, "Idempotency key already used for a different basket");
      return saved;
    }
    member(user, (UUID) c.get("society_id"));
    one("select id from societies where id=? and active", c.get("society_id"));
    Instant now = Instant.now();
    if (!c.get("status").equals("OPEN")
        || now.isBefore(((java.sql.Timestamp) c.get("starts_at")).toInstant())
        || !now.isBefore(((java.sql.Timestamp) c.get("cutoff_at")).toInstant()))
      throw bad("Buying cycle is closed");
    var ids = new HashSet<UUID>();
    long total = 0, savings = 0;
    var prices = new ArrayList<Map<String, Object>>();
    for (var item : r.items()) {
      if (!ids.add(item.productId())) throw bad("Duplicate product");
      var p =
          one(
              "select cp.* from cycle_product_prices cp join products p on p.id=cp.product_id where"
                  + " cp.cycle_id=? and cp.product_id=? and p.active for update of cp",
              r.cycleId(),
              item.productId());
      if (((Number) p.get("stock")).intValue() < item.quantity())
        throw bad("Insufficient availability");
      total =
          Math.addExact(
              total,
              Math.multiplyExact(((Number) p.get("price_paise")).longValue(), item.quantity()));
      savings +=
          (((Number) p.get("reference_paise")).longValue()
                  - ((Number) p.get("price_paise")).longValue())
              * item.quantity();
      prices.add(p);
    }
    UUID id = UUID.randomUUID();
    String flat =
        (String)
            one(
                    "select flat from society_memberships where user_id=? and society_id=?",
                    user,
                    c.get("society_id"))
                .get("flat");
    db.update(
        "insert into"
            + " orders(id,user_id,cycle_id,idempotency_key,total_paise,savings_paise,method,flat)"
            + " values(?,?,?,?,?,?,?,?)",
        id,
        user,
        r.cycleId(),
        r.idempotencyKey(),
        total,
        savings,
        r.method(),
        flat);
    for (int i = 0; i < r.items().size(); i++) {
      var it = r.items().get(i);
      var p = prices.get(i);
      db.update(
          "insert into"
              + " order_items(order_id,product_id,supplier_id,quantity,price_paise,reference_paise,cost_paise)"
              + " values(?,?,?,?,?,?,?)",
          id,
          it.productId(),
          p.get("supplier_id"),
          it.quantity(),
          p.get("price_paise"),
          p.get("reference_paise"),
          p.get("cost_paise"));
      db.update(
          "update cycle_product_prices set stock=stock-? where cycle_id=? and product_id=?",
          it.quantity(),
          r.cycleId(),
          it.productId());
    }
    db.update("insert into payments(order_id,provider) values(?,?)", id, payments.name());
    return one("select * from orders where id=?", id);
  }

  @GetMapping("/orders/me")
  Object orders(Authentication a) {
    return db.queryForList(
        "select o.*,c.name cycle_name,coalesce(f.status,o.status) tracking_status,p.status"
            + " payment_status,r.status refund_status from orders o join buying_cycles c on"
            + " c.id=o.cycle_id left join fulfillments f on f.order_id=o.id left join payments p on"
            + " p.order_id=o.id left join refunds r on r.payment_id=p.id where user_id=? order by"
            + " o.created_at desc limit 100",
        uid(a));
  }

  @GetMapping("/orders/{id}")
  Object order(Authentication a, @PathVariable UUID id) {
    var o = one("select * from orders where id=? and user_id=?", id, uid(a));
    return Map.of(
        "order",
        o,
        "items",
        db.queryForList(
            "select oi.*,p.name from order_items oi join products p on p.id=oi.product_id where"
                + " order_id=?",
            id));
  }

  @PostMapping("/payments/create")
  Object payment(Authentication a, @Valid @RequestBody Simulation r) {
    one("select id from orders where id=? and user_id=?", r.orderId(), uid(a));
    return one("select * from payments where order_id=?", r.orderId());
  }

  @PostMapping("/payments/simulate")
  @Transactional
  Object simulate(Authentication a, @Valid @RequestBody Simulation r) {
    UUID cycle =
        (UUID)
            one("select cycle_id from orders where id=? and user_id=?", r.orderId(), uid(a))
                .get("cycle_id");
    var c = one("select * from buying_cycles where id=? for update", cycle);
    var o = one("select * from orders where id=? for update", r.orderId());
    var p = one("select * from payments where order_id=? for update", r.orderId());
    if (!p.get("status").equals("PENDING")) return p;
    if (!c.get("status").equals("OPEN")
        || !Instant.now().isBefore(((java.sql.Timestamp) c.get("cutoff_at")).toInstant()))
      throw bad("Payment deadline passed");
    payments.confirm(r.success());
    db.update(
        "update payments set status=? where order_id=?",
        r.success() ? "PAID" : "FAILED",
        r.orderId());
    db.update(
        "update orders set status=? where id=?", r.success() ? "PAID" : "CANCELLED", r.orderId());
    if (!r.success()) restore(r.orderId(), cycle);
    return one("select * from payments where order_id=?", r.orderId());
  }

  void restore(UUID order, UUID cycle) {
    db.update(
        "update cycle_product_prices cp set stock=cp.stock+oi.quantity from order_items oi where"
            + " oi.order_id=? and cp.cycle_id=? and cp.product_id=oi.product_id",
        order,
        cycle);
  }

  @GetMapping("/admin/dashboard")
  Object dashboard() {
    return Map.of(
        "customers",
        db.queryForObject("select count(*) from users where role='CUSTOMER'", Long.class),
        "societies",
        db.queryForObject("select count(*) from societies", Long.class),
        "activeCycles",
        db.queryForObject(
            "select count(*) from buying_cycles where status='OPEN' and cutoff_at>now()",
            Long.class),
        "pendingMemberships",
        db.queryForObject(
            "select count(*) from society_memberships where status='PENDING'", Long.class),
        "sales",
        one(
            "select count(*) paid_orders,coalesce(sum(total_paise),0)"
                + " gmv_paise,coalesce(sum(savings_paise),0)"
                + " savings_paise,coalesce(avg(total_paise),0) average_paise from orders where"
                + " status='PAID'"),
        "estimatedMarginPaise",
        db.queryForObject(
            "select coalesce(sum((i.price_paise-i.cost_paise)*i.quantity),0) from order_items i"
                + " join orders o on o.id=i.order_id where o.status='PAID'",
            Long.class));
  }

  @GetMapping("/admin/memberships")
  Object pending() {
    return db.queryForList(
        "select m.*,u.name,u.email,s.name society_name from society_memberships m join users u on"
            + " u.id=m.user_id join societies s on s.id=m.society_id order by m.created_at desc"
            + " limit 100");
  }

  @PatchMapping("/admin/memberships/{id}")
  @Transactional
  Object approve(Authentication a, @PathVariable UUID id, @Valid @RequestBody Status r) {
    if (!Set.of("APPROVED", "REJECTED").contains(r.status()))
      throw bad("Invalid membership status");
    one("select id from society_memberships where id=?", id);
    db.update(
        "update society_memberships set status=?,updated_at=now() where id=?", r.status(), id);
    audit(a, "MEMBERSHIP_" + r.status(), id);
    return Map.of("ok", true);
  }

  @PostMapping("/admin/societies")
  Object createSociety(Authentication a, @Valid @RequestBody Society r) {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into societies(id,name,location,active) values(?,?,?,?)",
        id,
        r.name(),
        r.location(),
        r.active());
    audit(a, "CREATE_SOCIETY", id);
    return Map.of("id", id);
  }

  @PatchMapping("/admin/societies/{id}")
  Object editSociety(Authentication a, @PathVariable UUID id, @Valid @RequestBody Society r) {
    db.update(
        "update societies set name=?,location=?,active=?,updated_at=now() where id=?",
        r.name(),
        r.location(),
        r.active(),
        id);
    audit(a, "UPDATE_SOCIETY", id);
    return Map.of("id", id);
  }

  @PostMapping("/admin/products")
  Object addProduct(Authentication a, @Valid @RequestBody Product r) {
    UUID id = UUID.randomUUID();
    db.update(
        "insert into products(id,category_id,name,brand,pack_size,image,active)"
            + " values(?,?,?,?,?,?,?)",
        id,
        r.categoryId(),
        r.name(),
        r.brand(),
        r.packSize(),
        r.image(),
        r.active());
    audit(a, "CREATE_PRODUCT", id);
    return Map.of("id", id);
  }

  @PatchMapping("/admin/products/{id}")
  Object editProduct(Authentication a, @PathVariable UUID id, @Valid @RequestBody Product r) {
    db.update(
        "update products set"
            + " category_id=?,name=?,brand=?,pack_size=?,image=?,active=?,updated_at=now() where"
            + " id=?",
        r.categoryId(),
        r.name(),
        r.brand(),
        r.packSize(),
        r.image(),
        r.active(),
        id);
    audit(a, "UPDATE_PRODUCT", id);
    return Map.of("id", id);
  }

  @GetMapping("/admin/suppliers")
  Object suppliers() {
    return db.queryForList("select * from suppliers order by name");
  }

  @PostMapping("/admin/suppliers")
  Object supplier(Authentication a, @Valid @RequestBody Supplier r) {
    UUID id = UUID.randomUUID();
    db.update("insert into suppliers(id,name,email) values(?,?,?)", id, r.name(), r.email());
    audit(a, "CREATE_SUPPLIER", id);
    return Map.of("id", id);
  }

  @GetMapping("/admin/cycles")
  Object allCycles() {
    return db.queryForList(
        "select c.*,s.name society_name from buying_cycles c join societies s on s.id=c.society_id"
            + " order by created_at desc limit 100");
  }

  @PostMapping("/admin/cycles")
  @Transactional
  Object createCycle(Authentication a, @Valid @RequestBody Cycle r) {
    if (!r.cutoffAt().isAfter(r.startsAt())) throw bad("Cutoff must follow start");
    UUID id = UUID.randomUUID();
    db.update(
        "insert into buying_cycles(id,society_id,name,starts_at,cutoff_at,minimum_paise)"
            + " values(?,?,?,?,?,?)",
        id,
        r.societyId(),
        r.name(),
        java.sql.Timestamp.from(r.startsAt()),
        java.sql.Timestamp.from(r.cutoffAt()),
        r.minimumPaise());
    for (var p : r.prices()) {
      one("select id from products where id=? and active", p.productId());
      one("select id from suppliers where id=? and active", p.supplierId());
      if (p.referencePaise() < p.pricePaise())
        throw bad("Reference price must be at least group price");
      db.update(
          "insert into"
              + " cycle_product_prices(cycle_id,product_id,supplier_id,price_paise,reference_paise,cost_paise,stock,reference_source)"
              + " values(?,?,?,?,?,?,?,?)",
          id,
          p.productId(),
          p.supplierId(),
          p.pricePaise(),
          p.referencePaise(),
          p.costPaise(),
          p.stock(),
          p.referenceSource());
    }
    audit(a, "CREATE_CYCLE", id);
    return Map.of("id", id);
  }

  @PostMapping("/admin/cycles/{id}/close")
  @Transactional
  Object close(Authentication a, @PathVariable UUID id) {
    var c = one("select * from buying_cycles where id=? for update", id);
    if (!c.get("status").equals("OPEN")) return c;
    long total =
        db.queryForObject(
            "select coalesce(sum(total_paise),0) from orders where cycle_id=? and status='PAID'",
            Long.class,
            id);
    boolean success = total >= ((Number) c.get("minimum_paise")).longValue();
    db.update(
        "update buying_cycles set status=?,updated_at=now() where id=?",
        success ? "SUCCESS" : "FAILED",
        id);
    for (var o : db.queryForList("select * from orders where cycle_id=?", id)) {
      UUID oid = (UUID) o.get("id");
      if (o.get("status").equals("PAYMENT_PENDING")) {
        db.update("update orders set status='CANCELLED' where id=?", oid);
        db.update("update payments set status='FAILED' where order_id=?", oid);
        restore(oid, id);
      } else if (o.get("status").equals("PAID")) {
        if (success)
          db.update("insert into fulfillments(order_id) values(?) on conflict do nothing", oid);
        else refund(oid, id);
      }
    }
    if (success) {
      for (var s :
          db.queryForList(
              "select distinct i.supplier_id from order_items i join orders o on o.id=i.order_id"
                  + " where o.cycle_id=? and o.status='PAID'",
              id)) {
        UUID sid = UUID.randomUUID();
        db.update(
            "insert into supplier_orders(id,cycle_id,supplier_id) values(?,?,?)",
            sid,
            id,
            s.get("supplier_id"));
        db.update(
            "insert into supplier_order_items(supplier_order_id,product_id,quantity,cost_paise)"
                + " select ?,i.product_id,sum(i.quantity),i.cost_paise from order_items i join"
                + " orders o on o.id=i.order_id where o.cycle_id=? and o.status='PAID' and"
                + " i.supplier_id=? group by i.product_id,i.cost_paise",
            sid,
            id,
            s.get("supplier_id"));
      }
    }
    audit(a, "CLOSE_CYCLE", id);
    return one("select * from buying_cycles where id=?", id);
  }

  void refund(UUID oid, UUID cycle) {
    payments.refund();
    db.update(
        "insert into refunds(payment_id,amount_paise,status) select"
            + " p.id,o.total_paise,'SIMULATED_REFUNDED' from payments p join orders o on"
            + " o.id=p.order_id where o.id=? on conflict do nothing",
        oid);
    db.update("update payments set status='REFUNDED' where order_id=?", oid);
    db.update("update orders set status='REFUNDED' where id=?", oid);
    restore(oid, cycle);
  }

  @GetMapping("/admin/cycles/{id}/summary")
  Object summary(@PathVariable UUID id) {
    return db.queryForList(
        "select so.id supplier_order_id,s.name supplier,p.name product,i.quantity,i.cost_paise from"
            + " supplier_orders so join suppliers s on s.id=so.supplier_id join"
            + " supplier_order_items i on i.supplier_order_id=so.id join products p on"
            + " p.id=i.product_id where so.cycle_id=? order by s.name,p.name",
        id);
  }

  @GetMapping("/admin/orders")
  Object adminOrders(@RequestParam(defaultValue = "") String status) {
    return db.queryForList(
        "select o.*,u.name customer,f.id fulfillment_id,f.status tracking_status from orders o join"
            + " users u on u.id=o.user_id left join fulfillments f on f.order_id=o.id where (?=''"
            + " or o.status=?) order by o.created_at desc limit 100",
        status,
        status);
  }

  @PatchMapping("/admin/fulfillments/{id}")
  @Transactional
  Object fulfill(Authentication a, @PathVariable UUID id, @Valid @RequestBody Status r) {
    var f =
        one(
            "select f.*,o.method from fulfillments f join orders o on o.id=f.order_id where f.id=?"
                + " for update of f",
            id);
    var states =
        List.of(
            "PROCESSING",
            "SUPPLIER_CONFIRMED",
            "PACKED",
            f.get("method").equals("DELIVERY") ? "OUT_FOR_DELIVERY" : "READY_FOR_COLLECTION",
            "DELIVERED");
    int current = states.indexOf(f.get("status")), next = states.indexOf(r.status());
    if (next != current && next != current + 1) throw bad("Invalid fulfillment transition");
    db.update("update fulfillments set status=?,updated_at=now() where id=?", r.status(), id);
    audit(a, "FULFILL_" + r.status(), id);
    return Map.of("ok", true);
  }

  @PostMapping("/admin/orders/{id}/refund")
  @Transactional
  Object cancel(Authentication a, @PathVariable UUID id) {
    UUID cycle = (UUID) one("select cycle_id from orders where id=?", id).get("cycle_id");
    var c = one("select * from buying_cycles where id=? for update", cycle);
    var o = one("select * from orders where id=? for update", id);
    if (o.get("status").equals("REFUNDED")) return o;
    if (!c.get("status").equals("OPEN") || !o.get("status").equals("PAID"))
      throw bad("Only paid orders in open cycles may be refunded");
    refund(id, cycle);
    audit(a, "REFUND_ORDER", id);
    return Map.of("ok", true);
  }
}
