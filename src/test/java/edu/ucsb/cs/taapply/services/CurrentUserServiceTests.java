package edu.ucsb.cs.taapply.services;

import static org.assertj.core.api.Assertions.assertThat;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.model.CurrentUser;
import java.util.Collection;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

class CurrentUserServiceTests {

  private CurrentUserService serviceReturningUser(User user) {
    return new CurrentUserService() {
      @Override
      public User getUser() {
        return user;
      }

      @Override
      public CurrentUser getCurrentUser() {
        return null;
      }

      @Override
      public Collection<? extends GrantedAuthority> getRoles() {
        return List.of();
      }
    };
  }

  @Test
  void isLoggedInReturnsFalseWhenUserIsNull() {
    assertThat(serviceReturningUser(null).isLoggedIn()).isFalse();
  }

  @Test
  void isLoggedInReturnsTrueWhenUserIsNotNull() {
    User user = User.builder().email("test@example.com").build();
    assertThat(serviceReturningUser(user).isLoggedIn()).isTrue();
  }
}
