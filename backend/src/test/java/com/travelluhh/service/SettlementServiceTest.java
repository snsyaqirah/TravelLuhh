package com.travelluhh.service;

import com.travelluhh.dto.trip.SettlementResponse;
import com.travelluhh.dto.trip.SettlementResponse.Balance;
import com.travelluhh.dto.trip.SettlementResponse.Transaction;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.TripMemberBudgetRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SettlementServiceTest {

    private static final long TRIP_ID = 9L;
    private static final User AIMAN = user(1L, "Aiman");
    private static final User SITI = user(2L, "Siti");
    private static final User CHONG = user(3L, "Chong");
    private static final User MEI = user(4L, "Mei");

    @Mock private ExpenseRepository expenseRepository;
    @Mock private UserRepository userRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private TripMemberBudgetRepository budgetRepository;
    @Mock private TripRepository tripRepository;
    @Mock private ActivityService activityService;

    private SettlementService service;
    private Trip trip;
    private final List<TripMember> rows = new ArrayList<>();

    private static User user(long id, String name) {
        return User.builder().id(id).name(name).email(name.toLowerCase() + "@example.test").build();
    }

    private static BigDecimal money(String s) {
        return new BigDecimal(s);
    }

    @BeforeEach
    void setUp() {
        TripAccessService access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        MemberService members = new MemberService(tripMemberRepository, budgetRepository, userRepository, access, activityService);
        service = new SettlementService(expenseRepository, userRepository, members, access);

        trip = Trip.builder().id(TRIP_ID).ownerId(AIMAN.getId()).currency("MYR").budgetType("shared")
                .name("Tokyo autumn").build();
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        for (User u : List.of(AIMAN, SITI, CHONG, MEI)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
            when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        }
        when(tripMemberRepository.findByTripIdWithUser(TRIP_ID)).thenReturn(rows);
        when(tripMemberRepository.findRole(any(), any())).thenAnswer(inv -> rows.stream()
                .filter(m -> m.getUserId().equals(inv.getArgument(1)))
                .map(TripMember::getRole)
                .findFirst());
        when(expenseRepository.sumByPayer(TRIP_ID)).thenReturn(List.of());
    }

    private void members(User... users) {
        long id = 100;
        for (User u : users) {
            MemberRole role = u == AIMAN ? MemberRole.owner : MemberRole.editor;
            rows.add(TripMember.builder().id(id++).trip(trip).userId(u.getId()).user(u).role(role)
                    .joinedAt(LocalDateTime.of(2026, 10, 1, 9, 0).plusMinutes(id)).build());
        }
    }

    private void paid(Object... userIdThenAmount) {
        List<ExpenseRepository.PayerTotal> totals = new ArrayList<>();
        for (int i = 0; i < userIdThenAmount.length; i += 2) {
            Long userId = (Long) userIdThenAmount[i];
            BigDecimal total = money((String) userIdThenAmount[i + 1]);
            totals.add(new ExpenseRepository.PayerTotal() {
                public Long getUserId() { return userId; }
                public BigDecimal getTotal() { return total; }
            });
        }
        when(expenseRepository.sumByPayer(TRIP_ID)).thenReturn(totals);
    }

    private SettlementResponse settle() {
        return service.calculate(TRIP_ID, AIMAN.getEmail());
    }

    private static Balance balanceOf(SettlementResponse r, User u) {
        return r.getBalances().stream().filter(b -> b.getUserId().equals(u.getId())).findFirst().orElseThrow();
    }

    /** Σshare = total, Σnet = 0, and applying the transfers zeroes every net. */
    private static void assertBalanced(SettlementResponse r) {
        BigDecimal shares = r.getBalances().stream().map(Balance::getShare).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal paid = r.getBalances().stream().map(Balance::getPaid).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal nets = r.getBalances().stream().map(Balance::getNet).reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(shares).isEqualByComparingTo(r.getTotalSpent());
        assertThat(paid).isEqualByComparingTo(r.getTotalSpent());
        assertThat(nets).isEqualByComparingTo("0");

        Map<Long, BigDecimal> left = new HashMap<>();
        r.getBalances().forEach(b -> left.put(b.getUserId(), b.getNet()));
        for (Transaction t : r.getTransactions()) {
            assertThat(t.getAmount()).isPositive();
            left.merge(t.getFromUserId(), t.getAmount(), BigDecimal::add);
            left.merge(t.getToUserId(), t.getAmount().negate(), BigDecimal::add);
        }
        left.values().forEach(v -> assertThat(v).isEqualByComparingTo("0"));
        assertThat(r.getTransactions().size()).isLessThanOrEqualTo(Math.max(0, r.getBalances().size() - 1));
        r.getBalances().forEach(b -> {
            assertThat(b.getShare().scale()).isEqualTo(2);
            assertThat(b.getNet().scale()).isEqualTo(2);
        });
    }

    @Nested
    class Shared {

        @Test
        void threePeopleUnevenPayments() {
            members(AIMAN, SITI, CHONG);
            paid(1L, "300.00", 2L, "90.50");

            SettlementResponse r = settle();

            assertThat(r.getTotalSpent()).isEqualByComparingTo("390.50");
            assertThat(r.getCurrency()).isEqualTo("MYR");
            assertThat(r.getPerPerson()).isEqualByComparingTo("130.17");
            // 39050 / 3 = 13016 r 2: the two biggest payers take the extra cent.
            assertThat(balanceOf(r, AIMAN).getShare()).isEqualByComparingTo("130.17");
            assertThat(balanceOf(r, SITI).getShare()).isEqualByComparingTo("130.17");
            assertThat(balanceOf(r, CHONG).getShare()).isEqualByComparingTo("130.16");
            assertThat(balanceOf(r, AIMAN).getNet()).isEqualByComparingTo("169.83");
            assertThat(balanceOf(r, SITI).getNet()).isEqualByComparingTo("-39.67");
            assertThat(balanceOf(r, CHONG).getNet()).isEqualByComparingTo("-130.16");
            assertThat(balanceOf(r, CHONG).getPaid()).isEqualByComparingTo("0.00");

            assertThat(r.getTransactions()).hasSize(2);
            Transaction first = r.getTransactions().get(0);
            assertThat(first.getFromUserId()).isEqualTo(CHONG.getId());
            assertThat(first.getToUserId()).isEqualTo(AIMAN.getId());
            assertThat(first.getAmount()).isEqualByComparingTo("130.16");
            assertThat(first.getFromName()).isEqualTo("Chong");
            assertThat(first.getToName()).isEqualTo("Aiman");
            Transaction second = r.getTransactions().get(1);
            assertThat(second.getFromUserId()).isEqualTo(SITI.getId());
            assertThat(second.getAmount()).isEqualByComparingTo("39.67");
            assertBalanced(r);
        }

        @Test
        void centRemainderIsDistributedSoSharesAddUp() {
            members(AIMAN, SITI, CHONG);
            paid(2L, "100.00");

            SettlementResponse r = settle();

            assertThat(balanceOf(r, SITI).getShare()).isEqualByComparingTo("33.34");
            assertThat(balanceOf(r, AIMAN).getShare()).isEqualByComparingTo("33.33");
            assertThat(balanceOf(r, CHONG).getShare()).isEqualByComparingTo("33.33");
            assertThat(balanceOf(r, SITI).getNet()).isEqualByComparingTo("66.66");
            assertThat(r.getPerPerson()).isEqualByComparingTo("33.33");
            assertThat(r.getTransactions()).extracting(Transaction::getAmount)
                    .usingElementComparator(BigDecimal::compareTo)
                    .containsExactly(money("33.33"), money("33.33"));
            assertBalanced(r);
        }

        @Test
        void oneCentAcrossThree() {
            members(AIMAN, SITI, CHONG);
            paid(3L, "0.01");

            SettlementResponse r = settle();

            assertThat(balanceOf(r, CHONG).getShare()).isEqualByComparingTo("0.01");
            assertThat(balanceOf(r, CHONG).getNet()).isEqualByComparingTo("0.00");
            assertThat(r.getTransactions()).isEmpty();
            assertBalanced(r);
        }

        @Test
        void soloTripsSplitLikeShared() {
            trip.setBudgetType("solo");
            members(AIMAN, SITI);
            paid(1L, "50.00");

            SettlementResponse r = settle();

            assertThat(balanceOf(r, SITI).getNet()).isEqualByComparingTo("-25.00");
            assertThat(r.getTransactions()).hasSize(1);
            assertBalanced(r);
        }

        @Test
        void viewersTakeAShare() {
            members(AIMAN, SITI);
            rows.get(1).setRole(MemberRole.viewer);
            paid(1L, "80.00");

            SettlementResponse r = settle();

            assertThat(balanceOf(r, SITI).getShare()).isEqualByComparingTo("40.00");
            assertBalanced(r);
        }

        @Test
        void someoneWhoLeftIsStillPaidBack() {
            members(AIMAN, SITI);
            paid(1L, "60.00", 4L, "30.00");
            when(userRepository.findAllById(any())).thenReturn(List.of(MEI));

            SettlementResponse r = settle();

            Balance mei = balanceOf(r, MEI);
            assertThat(mei.getOnTrip()).isFalse();
            assertThat(mei.getShare()).isEqualByComparingTo("0.00");
            assertThat(mei.getNet()).isEqualByComparingTo("30.00");
            assertThat(balanceOf(r, AIMAN).getOnTrip()).isTrue();
            assertThat(balanceOf(r, AIMAN).getShare()).isEqualByComparingTo("45.00");
            assertThat(r.getBalances()).extracting(Balance::getUserId).containsExactly(1L, 2L, 4L);
            assertThat(r.getPerPerson()).isEqualByComparingTo("45.00");
            assertBalanced(r);
        }

        @Test
        void expensesWithNoPayerAccountAreLeftOut() {
            members(AIMAN, SITI);
            paid(1L, "20.00", null, "99.00");

            SettlementResponse r = settle();

            assertThat(r.getTotalSpent()).isEqualByComparingTo("20.00");
            assertBalanced(r);
        }

        @Test
        void randomTripsAlwaysBalance() {
            Random random = new Random(42);
            List<User> everyone = List.of(AIMAN, SITI, CHONG, MEI);
            for (int run = 0; run < 200; run++) {
                List<SettlementService.Person> people = new ArrayList<>();
                Map<Long, BigDecimal> paid = new HashMap<>();
                int n = 1 + random.nextInt(4);
                for (int i = 0; i < n; i++) {
                    User u = everyone.get(i);
                    people.add(new SettlementService.Person(u.getId(), u.getName(), null, i < 3 || random.nextBoolean()));
                    if (random.nextBoolean()) {
                        paid.put(u.getId(), BigDecimal.valueOf(random.nextInt(1_000_000), 2));
                    }
                }
                if (people.stream().noneMatch(SettlementService.Person::onTrip)) continue;
                assertBalanced(SettlementService.settle(people, paid, "shared", "MYR"));
            }
        }
    }

    @Nested
    class Separated {

        @Test
        void everyoneCarriesTheirOwnSpendAndNobodyTransfers() {
            trip.setBudgetType("separated");
            members(AIMAN, SITI, CHONG);
            paid(1L, "300.00", 2L, "90.50");

            SettlementResponse r = settle();

            assertThat(balanceOf(r, AIMAN).getShare()).isEqualByComparingTo("300.00");
            assertThat(balanceOf(r, SITI).getShare()).isEqualByComparingTo("90.50");
            assertThat(balanceOf(r, CHONG).getShare()).isEqualByComparingTo("0.00");
            r.getBalances().forEach(b -> assertThat(b.getNet()).isEqualByComparingTo("0"));
            assertThat(r.getTransactions()).isEmpty();
            assertThat(r.getPerPerson()).isEqualByComparingTo("130.17");
            assertBalanced(r);
        }
    }

    @Nested
    class EdgeCases {

        @Test
        void singleMemberOwesNobody() {
            members(AIMAN);
            paid(1L, "123.45");

            SettlementResponse r = settle();

            assertThat(r.getBalances()).hasSize(1);
            assertThat(balanceOf(r, AIMAN).getShare()).isEqualByComparingTo("123.45");
            assertThat(balanceOf(r, AIMAN).getNet()).isEqualByComparingTo("0.00");
            assertThat(r.getPerPerson()).isEqualByComparingTo("123.45");
            assertThat(r.getTransactions()).isEmpty();
        }

        @Test
        void zeroExpensesListsEveryoneAtZero() {
            members(AIMAN, SITI, CHONG);

            SettlementResponse r = settle();

            assertThat(r.getTotalSpent()).isEqualByComparingTo("0.00");
            assertThat(r.getPerPerson()).isEqualByComparingTo("0.00");
            assertThat(r.getBalances()).hasSize(3);
            r.getBalances().forEach(b -> {
                assertThat(b.getPaid()).isEqualByComparingTo("0");
                assertThat(b.getShare()).isEqualByComparingTo("0");
                assertThat(b.getNet()).isEqualByComparingTo("0");
            });
            assertThat(r.getTransactions()).isEmpty();
        }

        @Test
        void ownerWithoutAMemberRowIsStillIncluded() {
            // Legacy trip: only Siti has a trip_members row.
            members(SITI);
            paid(2L, "10.00");

            SettlementResponse r = settle();

            assertThat(r.getBalances()).extracting(Balance::getUserId).containsExactly(1L, 2L);
            assertThat(balanceOf(r, AIMAN).getNet()).isEqualByComparingTo("-5.00");
            assertBalanced(r);
        }

        @Test
        void nonMembersGet404() {
            members(AIMAN, SITI);

            assertThatThrownBy(() -> service.calculate(TRIP_ID, MEI.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage(TripAccessService.TRIP_NOT_FOUND);
        }

        @Test
        void anyMemberCanRead() {
            members(AIMAN, SITI);
            rows.get(1).setRole(MemberRole.viewer);

            assertThat(service.calculate(TRIP_ID, SITI.getEmail()).getBalances()).hasSize(2);
        }
    }
}
