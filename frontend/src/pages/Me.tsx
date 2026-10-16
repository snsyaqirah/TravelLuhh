// Me /me (§9.8): one column, at most 640px. A passport data page for a header, the lifetime baki jar, then
// ruled sections (no cards): Details, Money, Appearance, Security, Log out. Every form says how it went right
// under its button; nothing relies on a toast.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useMe } from '@/hooks/useMe';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PassportDataPage } from '@/components/me/PassportDataPage';
import { LifetimeBaki } from '@/components/me/LifetimeBaki';
import { MeSection } from '@/components/me/MeSection';
import { DetailsSection } from '@/components/me/DetailsSection';
import { MoneySection } from '@/components/me/MoneySection';
import { AppearanceSection } from '@/components/me/AppearanceSection';
import { SecuritySection } from '@/components/me/SecuritySection';
import { mergeTrips } from '@/components/passport/passportMath';

export default function Me() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { user, error, refetch, updateProfile, changePassword, isChangingPassword, isGoogleOnly } = useMe();
  const today = useToday();
  const homeCurrency = (user?.currency || 'MYR').toUpperCase();

  const active = useTrips();
  const archived = useTrips({ archived: true });
  const fx = useRates(homeCurrency);
  const trips = useMemo(() => mergeTrips(active.trips, archived.trips), [active.trips, archived.trips]);
  const [leaving, setLeaving] = useState(false);

  if (!user) {
    if (error) {
      return (
        <div role="alert" className="flex max-w-[640px] flex-col items-start gap-3 border-l-[3px] border-stamp bg-stamp-tint px-4 py-4">
          <p className="type-body text-ink">{error}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    return <AppSkeleton />;
  }

  const onLogout = async () => {
    setLeaving(true);
    // logout() clears this device's session before it waits on the server, so go to /login straight away.
    const pending = logout();
    navigate('/login', { replace: true });
    await pending.catch(() => undefined);
  };

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-8 lg:gap-10">
      <div className="flex flex-col gap-4">
        <PassportDataPage user={user} />
        {active.isLoading ? (
          <Skeleton className="h-[90px] [--ledger-row:90px]" />
        ) : (
          <LifetimeBaki trips={trips} homeCurrency={homeCurrency} rates={fx.rates} today={today} />
        )}
      </div>

      <DetailsSection user={user} onSave={updateProfile} />
      <MoneySection user={user} onSave={updateProfile} />
      <AppearanceSection />
      <SecuritySection googleOnly={isGoogleOnly} onChangePassword={changePassword} busy={isChangingPassword} />

      <MeSection id="me-logout" title="Log out" description={`Signs ${user.email} out on this device.`}>
        <Button variant="secondary" onClick={() => void onLogout()} disabled={leaving}>
          {leaving ? 'Logging out…' : 'Log out'}
        </Button>
      </MeSection>
    </div>
  );
}
