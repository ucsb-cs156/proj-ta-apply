package edu.ucsb.cs.taapply.config;

import edu.ucsb.cs.taapply.interceptors.LastOnlineInterceptor;
import edu.ucsb.cs.taapply.interceptors.RoleUpdateInterceptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  @Autowired private RoleUpdateInterceptor roleUpdateInterceptor;
  @Autowired private LastOnlineInterceptor lastOnlineInterceptor;

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(roleUpdateInterceptor);
    // Only API calls count as being online: the frontend's static files are fetched by anyone.
    registry.addInterceptor(lastOnlineInterceptor).addPathPatterns("/api/**");
  }
}
