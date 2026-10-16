// Landing `/` (§9.1). Asymmetric 5/7 hero with the TripPlot demo, then the passbook, the three kinds of trip,
// live rates and the footer. Signed-in visitors go straight to /home.
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { AnnotatedPassbook } from '@/components/frontdoor/AnnotatedPassbook';
import { HeroDemo } from '@/components/frontdoor/HeroDemo';
import { LiveRates } from '@/components/frontdoor/LiveRates';
import { SiteBar, SiteFooter } from '@/components/frontdoor/SiteChrome';
import { TripKinds } from '@/components/frontdoor/TripKinds';

const wrap = 'mx-auto w-full max-w-[1168px] px-4 lg:px-6';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-dvh bg-background">
      <SiteBar />

      <main id="main">
        {/* Hero: copy left (5), scene right (7). On phones the scene comes first, above the H1. */}
        <section aria-labelledby="hero-title" className={`${wrap} grid gap-8 pb-14 pt-4 lg:grid-cols-12 lg:gap-6 lg:pb-24 lg:pt-12`}>
          <div className="order-2 flex flex-col lg:order-1 lg:col-span-5 lg:justify-center lg:pb-16">
            <p className="type-overline text-ink-2">A travel fund for people who actually go</p>
            <h1 id="hero-title" className="type-display-1 mt-3 text-ink">
              Every trip starts as a <em className="font-medium italic">tabung</em>.
            </h1>
            <p className="type-body mt-4 max-w-[44ch] text-ink-2">
              Set a target, then spend through it on the road. Every ringgit accounted for, in whatever currency you're paying in.
            </p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/register">Start a tabung</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto sm:px-0">
                <Link to="/login">I already have one</Link>
              </Button>
            </div>
          </div>
          <HeroDemo className="order-1 lg:order-2 lg:col-span-7" />
        </section>

        {/* Where did all the ringgit go? */}
        <section aria-labelledby="passbook-title" className="border-t border-rule">
          <div className={`${wrap} py-14 lg:py-24`}>
            <div className="grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-6">
              <div className="lg:col-span-6">
                <p className="type-overline text-ink-2">The passbook</p>
                <h2 id="passbook-title" className="type-display-2 mt-3 text-ink">
                  Where did all the ringgit go?
                </h2>
              </div>
              <p className="type-body max-w-[52ch] text-ink-2 lg:col-span-5 lg:col-start-8">
                Every spend prints as a line with the balance after it, like the bank book you had as a kid. Paid ¥ 3,200 for ramen? It's
                there in yen, and in ringgit at that day's rate.
              </p>
            </div>
            <AnnotatedPassbook className="mt-8 lg:mt-10" />
          </div>
        </section>

        {/* The three kinds of trip, as a ruled list. */}
        <section aria-labelledby="kinds-title" className="border-t border-rule">
          <div className={`${wrap} grid gap-8 py-14 lg:grid-cols-12 lg:gap-6 lg:py-24`}>
            <div className="lg:col-span-4">
              <p className="type-overline text-ink-2">Solo or with the geng</p>
              <h2 id="kinds-title" className="type-display-2 mt-3 text-ink">
                Built for the trips you actually take
              </h2>
            </div>
            <div className="lg:col-span-8">
              <TripKinds />
            </div>
          </div>
        </section>

        {/* Live rates */}
        <section aria-labelledby="rates-title" className="border-t border-rule">
          <div className={`${wrap} grid gap-8 py-14 lg:grid-cols-12 lg:gap-6 lg:py-24`}>
            <div className="lg:col-span-5">
              <p className="type-overline text-ink-2">Live rates</p>
              <h2 id="rates-title" className="type-display-3 mt-3 text-ink">
                What RM 1 buys today
              </h2>
              <p className="type-body mt-3 max-w-[44ch] text-ink-2">
                Pay in yen, baht or won and the ledger converts at the day's rate from Frankfurter, so every ≈ RM means something.
              </p>
              <Button asChild className="mt-6 hidden lg:inline-flex">
                <Link to="/register">Start a tabung</Link>
              </Button>
            </div>
            <LiveRates className="lg:col-span-6 lg:col-start-7" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
