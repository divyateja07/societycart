package com.societycart;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
class ManagementApi {
  private final JdbcTemplate db;

  ManagementApi(JdbcTemplate db) {
    this.db = db;
  }

  UUID user(Authentication a) {
    return db.queryForObject("select id from users where email=?", UUID.class, a.getName());
  }

  void audit(Authentication a, String action, UUID id) {
    db.update(
        "insert into audit_logs(actor_id,action,target_id) values(?,?,?)", user(a), action, id);
  }

  record Name(@NotBlank @Size(max = 100) String name) {}

  record Supplier(
      @NotBlank @Size(max = 200) String name, @NotBlank @Email String email, boolean active) {}

  record Quote(@NotNull UUID productId, @Min(0) long costPaise) {}

  record State(@NotBlank String status) {}

  @PatchMapping("/profile")
  Object profile(Authentication a, @Valid @RequestBody Name r) {
    db.update("update users set name=?,updated_at=now() where id=?", r.name(), user(a));
    return Map.of("ok", true);
  }

  @GetMapping("/admin/societies")
  Object societies() {
    return db.queryForList("select * from societies order by name limit 100");
  }

  @GetMapping("/admin/products")
  Object products() {
    return db.queryForList(
        "select p.*,c.name category from products p join categories c on c.id=p.category_id order"
            + " by p.name limit 100");
  }

  @PostMapping("/admin/categories")
  @Transactional
  Object category(Authentication a, @Valid @RequestBody Name r) {
    UUID id = UUID.randomUUID();
    db.update("insert into categories(id,name) values(?,?)", id, r.name());
    audit(a, "CREATE_CATEGORY", id);
    return Map.of("id", id);
  }

  @PatchMapping("/admin/categories/{id}")
  @Transactional
  Object category(Authentication a, @PathVariable UUID id, @Valid @RequestBody Name r) {
    db.update("update categories set name=? where id=?", r.name(), id);
    audit(a, "UPDATE_CATEGORY", id);
    return Map.of("id", id);
  }

  @PatchMapping("/admin/suppliers/{id}")
  @Transactional
  Object supplier(Authentication a, @PathVariable UUID id, @Valid @RequestBody Supplier r) {
    db.update(
        "update suppliers set name=?,email=?,active=? where id=?",
        r.name(),
        r.email(),
        r.active(),
        id);
    audit(a, "UPDATE_SUPPLIER", id);
    return Map.of("id", id);
  }

  @GetMapping("/admin/suppliers/{id}/products")
  Object quotes(@PathVariable UUID id) {
    return db.queryForList(
        "select sp.*,p.name product_name from supplier_products sp join products p on"
            + " p.id=sp.product_id where supplier_id=?",
        id);
  }

  @PostMapping("/admin/suppliers/{id}/products")
  @Transactional
  Object quote(Authentication a, @PathVariable UUID id, @Valid @RequestBody Quote r) {
    db.update(
        "insert into supplier_products(supplier_id,product_id,cost_paise) values(?,?,?) on"
            + " conflict(supplier_id,product_id) do update set cost_paise=excluded.cost_paise",
        id,
        r.productId(),
        r.costPaise());
    audit(a, "UPDATE_QUOTE", id);
    return Map.of("ok", true);
  }

  @GetMapping("/admin/cycles/{id}/demand")
  Object demand(@PathVariable UUID id) {
    return db.queryForList(
        "select p.id,p.name,sum(i.quantity) quantity,sum(i.price_paise*i.quantity) sales_paise from"
            + " order_items i join orders o on o.id=i.order_id join products p on p.id=i.product_id"
            + " where o.cycle_id=? and o.status='PAID' group by p.id,p.name order by p.name",
        id);
  }

  @GetMapping("/admin/supplier-orders")
  Object supplierOrders() {
    return db.queryForList(
        "select so.*,s.name supplier_name,c.name cycle_name from supplier_orders so join suppliers"
            + " s on s.id=so.supplier_id join buying_cycles c on c.id=so.cycle_id order by"
            + " c.created_at desc limit 100");
  }

  @PatchMapping("/admin/supplier-orders/{id}")
  @Transactional
  Object supplierOrder(Authentication a, @PathVariable UUID id, @Valid @RequestBody State r) {
    if (!Set.of("CREATED", "CONFIRMED", "DISPATCHED", "RECEIVED").contains(r.status()))
      throw Api.bad("Invalid supplier order status");
    db.update("update supplier_orders set status=? where id=?", r.status(), id);
    audit(a, "SUPPLIER_ORDER_" + r.status(), id);
    return Map.of("ok", true);
  }

  @GetMapping("/admin/analytics")
  Object analytics() {
    return Map.of(
        "salesBySociety",
        db.queryForList(
            "select s.name,count(o.id) orders,coalesce(sum(o.total_paise),0) sales_paise from"
                + " societies s left join buying_cycles c on c.society_id=s.id left join orders o"
                + " on o.cycle_id=c.id and o.status='PAID' group by s.id,s.name order by"
                + " sales_paise desc"),
        "ordersByCycle",
        db.queryForList(
            "select c.name,c.status,count(o.id) orders,coalesce(sum(o.total_paise),0) sales_paise"
                + " from buying_cycles c left join orders o on o.cycle_id=c.id and o.status='PAID'"
                + " group by c.id,c.name,c.status order by c.created_at desc limit 100"),
        "popularProducts",
        db.queryForList(
            "select p.name,sum(i.quantity) quantity,sum(i.price_paise*i.quantity) sales_paise from"
                + " order_items i join products p on p.id=i.product_id join orders o on"
                + " o.id=i.order_id where o.status='PAID' group by p.id,p.name order by quantity"
                + " desc limit 10"),
        "repeatCustomers",
        db.queryForObject(
            "select count(*) from (select user_id from orders where status='PAID' group by user_id"
                + " having count(*)>1) repeat",
            Long.class),
        "fulfillmentBacklog",
        db.queryForObject(
            "select count(*) from fulfillments where status<>'DELIVERED'", Long.class));
  }
}
