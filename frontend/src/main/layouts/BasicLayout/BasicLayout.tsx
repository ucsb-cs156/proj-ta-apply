import type { ReactNode } from "react";
import AppNavbar from "main/components/Nav/AppNavbar";
import Footer from "main/components/Nav/Footer";
import { useCurrentUser, useLogout } from "main/utils/currentUser";
import { useSystemInfo } from "main/utils/systemInfo";

interface BasicLayoutProps {
  children: ReactNode;
  /** Shown full width directly below the navbar, e.g. the "test only" warning. */
  banner?: ReactNode;
}

export default function BasicLayout({ children, banner }: BasicLayoutProps) {
  const doLogout = useLogout().mutate;
  const currentUser = useCurrentUser();
  const { data: systemInfo } = useSystemInfo();

  return (
    <div className="BasicLayout" data-testid="BasicLayout">
      <AppNavbar
        doLogout={doLogout}
        currentUser={currentUser}
        systemInfo={systemInfo}
      />
      {banner}
      <main
        className="main-content content-column"
        data-testid="BasicLayout-main-content"
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
