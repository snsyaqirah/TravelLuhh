package com.travelluhh.service;

import com.travelluhh.dto.trip.SettlementResponse;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.User;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Who owes whom on a trip (API contract, Settlement). Everything is computed in whole cents.
 *
 * - paid: what each person paid, attributed by COALESCE(paid_by, added_by) (ExpenseRepository.sumByPayer).
 * - shared and solo trips: totalSpent is split equally between everyone on the trip (owner, editors
 *   and viewers). The leftover cents go one each to the people who paid the most, so the shares
 *   add up to totalSpent exactly.
 * - separated trips: everyone carries their own spending, so share = paid and nobody transfers.
 * - net = paid - share; the nets add up to 0. Transfers come from a greedy match of the largest
 *   debtor with the largest creditor, which settles n people in at most n - 1 transfers.
 * - Someone who paid but has since left keeps a balance row (onTrip = false, share 0), so the
 *   others pay them back. Expenses whose payer account no longer exists can't be paid back to
 *   anyone and are left out.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SettlementService {

    private final ExpenseRepository expenseRepository;
    private final UserRepository userRepository;
    private final MemberService memberService;
    private final TripAccessService tripAccess;

    /** A person in the settlement, in display order. */
    record Person(Long userId, String name, String avatar, boolean onTrip) {}

    /** Any member of the trip. */
    public SettlementResponse calculate(Long tripId, String userEmail) {
        Trip trip = tripAccess.requireMember(tripId, userEmail);
        return calculate(trip);
    }

    SettlementResponse calculate(Trip trip) {
        List<Person> people = new ArrayList<>();
        Set<Long> onTrip = new HashSet<>();
        for (TripMember m : memberService.roster(trip)) {
            if (m.getUserId() != null && onTrip.add(m.getUserId())) {
                people.add(person(m.getUserId(), m.getUser(), true));
            }
        }

        Map<Long, BigDecimal> paid = new LinkedHashMap<>();
        for (ExpenseRepository.PayerTotal total : expenseRepository.sumByPayer(trip.getId())) {
            if (total.getUserId() != null && total.getTotal() != null) {
                paid.merge(total.getUserId(), total.getTotal(), BigDecimal::add);
            }
        }

        List<Long> formerIds = paid.keySet().stream().filter(id -> !onTrip.contains(id)).sorted().toList();
        if (!formerIds.isEmpty()) {
            Map<Long, User> former = userRepository.findAllById(formerIds).stream()
                    .collect(Collectors.toMap(User::getId, Function.identity()));
            for (Long id : formerIds) {
                people.add(person(id, former.get(id), false));
            }
        }

        return settle(people, paid, trip.getBudgetType(), trip.getCurrency());
    }

    /**
     * The pure calculation. paidByUser may omit people who paid nothing; entries for users not in
     * people are ignored.
     */
    static SettlementResponse settle(List<Person> people, Map<Long, BigDecimal> paidByUser,
                                     String budgetType, String currency) {
        int size = people.size();
        long[] paid = new long[size];
        long total = 0;
        int splitters = 0;
        for (int i = 0; i < size; i++) {
            paid[i] = toCents(paidByUser.get(people.get(i).userId()));
            total += paid[i];
            if (people.get(i).onTrip()) splitters++;
        }

        boolean separated = "separated".equalsIgnoreCase(budgetType);
        long[] share = separated ? paid.clone() : equalShares(people, paid, total, splitters);

        long[] net = new long[size];
        for (int i = 0; i < size; i++) {
            net[i] = paid[i] - share[i];
        }

        List<SettlementResponse.Balance> balances = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            Person p = people.get(i);
            balances.add(SettlementResponse.Balance.builder()
                    .userId(p.userId())
                    .name(p.name())
                    .avatar(p.avatar())
                    .paid(fromCents(paid[i]))
                    .share(fromCents(share[i]))
                    .net(fromCents(net[i]))
                    .onTrip(p.onTrip())
                    .build());
        }

        long perPerson = splitters == 0 ? 0 : divideHalfUp(total, splitters);
        return SettlementResponse.builder()
                .totalSpent(fromCents(total))
                .currency(currency)
                .perPerson(fromCents(perPerson))
                .balances(balances)
                .transactions(separated ? List.of() : transfers(people, net))
                .build();
    }

    /**
     * total / splitters for everyone on the trip, with the remainder handed out one cent at a time
     * to the biggest payers (ties: display order). People no longer on the trip take no share.
     */
    private static long[] equalShares(List<Person> people, long[] paid, long total, int splitters) {
        long[] share = new long[people.size()];
        if (splitters == 0) {
            return share;
        }
        long base = Math.floorDiv(total, splitters);
        long remainder = total - base * splitters;

        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < people.size(); i++) {
            if (people.get(i).onTrip()) {
                share[i] = base;
                order.add(i);
            }
        }
        order.sort(Comparator.comparingLong((Integer i) -> -paid[i]).thenComparingInt(i -> i));
        for (int k = 0; k < remainder; k++) {
            share[order.get(k)] += 1;
        }
        return share;
    }

    /** Greedy: repeatedly settle the largest debt against the largest credit (ties: display order). */
    private static List<SettlementResponse.Transaction> transfers(List<Person> people, long[] net) {
        long[] left = net.clone();
        List<SettlementResponse.Transaction> result = new ArrayList<>();
        while (true) {
            int debtor = -1;
            int creditor = -1;
            for (int i = 0; i < left.length; i++) {
                if (left[i] < 0 && (debtor < 0 || left[i] < left[debtor])) debtor = i;
                if (left[i] > 0 && (creditor < 0 || left[i] > left[creditor])) creditor = i;
            }
            if (debtor < 0 || creditor < 0) {
                return result;
            }
            long amount = Math.min(-left[debtor], left[creditor]);
            left[debtor] += amount;
            left[creditor] -= amount;
            Person from = people.get(debtor);
            Person to = people.get(creditor);
            result.add(SettlementResponse.Transaction.builder()
                    .fromUserId(from.userId())
                    .fromName(from.name())
                    .toUserId(to.userId())
                    .toName(to.name())
                    .amount(fromCents(amount))
                    .build());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static Person person(Long userId, User user, boolean onTrip) {
        return new Person(userId, TripAccessService.actorName(user), user != null ? user.getAvatar() : null, onTrip);
    }

    /** Expense amounts are stored with 2 decimals; anything finer is rounded half-up. */
    static long toCents(BigDecimal amount) {
        if (amount == null) return 0;
        return amount.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    static BigDecimal fromCents(long cents) {
        return BigDecimal.valueOf(cents, 2);
    }

    private static long divideHalfUp(long cents, int by) {
        return BigDecimal.valueOf(cents).divide(BigDecimal.valueOf(by), 0, RoundingMode.HALF_UP).longValueExact();
    }
}
