package com.societycart;

import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.csrf.*;

@Configuration
class Security {
  @Bean
  PasswordEncoder encoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  UserDetailsService users(com.societycart.users.UserRepository repository) {
    return email -> {
      var account =
          repository
              .findByEmail(email.toLowerCase(Locale.ROOT))
              .orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
      return User.withUsername(account.getEmail())
          .password(account.getPassword())
          .roles(account.getRole())
          .build();
    };
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    return http.authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/v1/auth/**", "/actuator/health", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    .requestMatchers("/api/v1/admin/**")
                    .hasRole("ADMIN")
                    .anyRequest()
                    .authenticated())
        .csrf(c -> c.csrfTokenRepository(new HttpSessionCsrfTokenRepository()))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint((r, s, x) -> s.sendError(401))
                    .accessDeniedHandler((r, s, x) -> s.sendError(403)))
        .formLogin(f -> f.disable())
        .httpBasic(b -> b.disable())
        .logout(l -> l.disable())
        .build();
  }
}
