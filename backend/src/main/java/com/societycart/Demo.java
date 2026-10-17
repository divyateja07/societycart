package com.societycart;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class Demo implements ApplicationRunner {
  final JdbcTemplate db;
  final PasswordEncoder encoder;
  final boolean demo;
  final String email, password;

  Demo(
      JdbcTemplate db,
      PasswordEncoder encoder,
      @Value("${app.demo}") boolean demo,
      @Value("${app.admin-email}") String email,
      @Value("${app.admin-password}") String password) {
    this.db = db;
    this.encoder = encoder;
    this.demo = demo;
    this.email = email;
    this.password = password;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!demo) return;
    if (!email.isBlank() && !password.isBlank()) {
      if (password.length() < 12)
        throw new IllegalStateException("Admin password must contain at least 12 characters");
      db.update(
          "insert into users(name,email,password,role) values('Local administrator',?,?,'ADMIN') on"
              + " conflict(email) do nothing",
          email.toLowerCase(Locale.ROOT),
          encoder.encode(password));
    }
    if (db.queryForObject("select count(*) from societies", Long.class) > 0) return;
    for (String name : List.of("Green Valley Apartments", "Sunrise Residency", "Lakeview Heights"))
      db.update("insert into societies(name,location) values(?,'Pune, Maharashtra')", name);
    for (String name :
        List.of(
            "Rice",
            "Atta and flour",
            "Pulses and dals",
            "Cooking oil",
            "Sugar and salt",
            "Spices",
            "Detergents",
            "Household cleaning",
            "Personal care")) db.update("insert into categories(name) values(?)", name);
    UUID supplier = UUID.randomUUID();
    db.update(
        "insert into suppliers(id,name,email) values(?,'Demo wholesale"
            + " supplier','supplier@example.invalid')",
        supplier);
    String[][] products = {
      {"Basmati rice", "5 kg", "Rice", "🌾", "62500", "75000"},
      {"Sona Masoori rice", "5 kg", "Rice", "🍚", "32500", "39000"},
      {"Wheat atta", "10 kg", "Atta and flour", "🌾", "42000", "49000"},
      {"Sunflower oil", "5 L", "Cooking oil", "🫙", "62000", "71000"},
      {"Toor dal", "1 kg", "Pulses and dals", "🫘", "14500", "17500"},
      {"Sugar", "1 kg", "Sugar and salt", "🧂", "4200", "4800"},
      {"Detergent powder", "3 kg", "Detergents", "🧺", "29000", "35000"},
      {"Floor cleaner", "1 L", "Household cleaning", "🧴", "16000", "19500"},
      {"Dishwash liquid", "1 L", "Household cleaning", "🫧", "18000", "22000"},
      {"Salt", "1 kg", "Sugar and salt", "🧂", "2200", "2800"}
    };
    UUID cycle = UUID.randomUUID();
    UUID society =
        db.queryForObject(
            "select id from societies where name='Green Valley Apartments'", UUID.class);
    db.update(
        "insert into buying_cycles(id,society_id,name,starts_at,cutoff_at,minimum_paise)"
            + " values(?,?,'Weekly pantry collective',now()-interval '1 hour',now()+interval '7"
            + " days',2000000)",
        cycle,
        society);
    for (var p : products) {
      UUID id = UUID.randomUUID();
      UUID cat = db.queryForObject("select id from categories where name=?", UUID.class, p[2]);
      long price = Long.parseLong(p[4]), reference = Long.parseLong(p[5]);
      db.update(
          "insert into products(id,category_id,name,brand,pack_size,image)"
              + " values(?,?,?,'SocietyCart Demo',?,?)",
          id,
          cat,
          p[0],
          p[1],
          p[3]);
      db.update(
          "insert into supplier_products(supplier_id,product_id,cost_paise) values(?,?,?)",
          supplier,
          id,
          price * 9 / 10);
      db.update(
          "insert into"
              + " cycle_product_prices(cycle_id,product_id,supplier_id,price_paise,reference_paise,cost_paise,reference_source,stock)"
              + " values(?,?,?,?,?,?,'Illustrative demo reference — not a market quote',1000)",
          cycle,
          id,
          supplier,
          price,
          reference,
          price * 9 / 10);
    }
  }
}
