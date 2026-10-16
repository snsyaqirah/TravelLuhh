package com.travelluhh.service;

import com.travelluhh.dto.budget.BudgetAllocationRequest;
import com.travelluhh.dto.trip.CreateTripRequest;
import com.travelluhh.dto.trip.UpdateTripRequest;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.TripFundEntryRepository;
import com.travelluhh.repository.TripMemberBudgetRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trip budgets and per-person budget allocations: sizes like 1e20000000 or 1e-20000000 are a fast
 * 400 in the service too, not only in DTO validation, and nothing is written.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MoneySizeGuardTest {

    private static final long TRIP_ID = 9L;
    private static final User OWNER = User.builder().id(1L).name("Aiman").email("aiman@example.com").build();
    private static final User EDITOR = User.builder().id(2L).name("Siti").email("siti@example.com").build();

    @Mock private TripRepository tripRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private TripFundEntryRepository fundEntryRepository;
    @Mock private TripMemberBudgetRepository budgetRepository;
    @Mock private MemberService memberService;
    @Mock private ActivityService activityService;

    private TripService tripService;
    private BudgetService budgetService;
    private Trip trip;

    @BeforeEach
    void setUp() {
        TripAccessService access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        tripService = new TripService(tripRepository, tripMemberRepository, expenseRepository, fundEntryRepository,
                access, activityService);
        budgetService = new BudgetService(budgetRepository, expenseRepository, memberService, access, activityService);

        trip = Trip.builder().id(TRIP_ID).ownerId(OWNER.getId()).currency("MYR").name("Tokyo autumn")
                .budgetType("separated").budget(new BigDecimal("3000.00"))
                .startDate(LocalDate.of(2026, 11, 1)).endDate(LocalDate.of(2026, 11, 8)).build();
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(userRepository.findByEmail(OWNER.getEmail())).thenReturn(Optional.of(OWNER));
        when(userRepository.findByEmail(EDITOR.getEmail())).thenReturn(Optional.of(EDITOR));
        when(tripMemberRepository.findRole(TRIP_ID, EDITOR.getId())).thenReturn(Optional.of(MemberRole.editor));
        when(memberService.roster(trip)).thenReturn(List.of(
                TripMember.builder().trip(trip).userId(OWNER.getId()).user(OWNER).role(MemberRole.owner).build(),
                TripMember.builder().trip(trip).userId(EDITOR.getId()).user(EDITOR).role(MemberRole.editor).build()));
    }

    private static CreateTripRequest newTrip(String budget) {
        CreateTripRequest r = new CreateTripRequest();
        r.setName("Seoul");
        r.setDestinationCountry("KR");
        r.setStartDate(LocalDate.of(2026, 12, 1));
        r.setEndDate(LocalDate.of(2026, 12, 6));
        r.setBudget(new BigDecimal(budget));
        r.setCurrency("MYR");
        return r;
    }

    @Test
    void createTripRejectsHugeBudgetsFast() {
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
            for (String v : List.of("1e20000000", "1e-20000000", "12345678901", "10.005")) {
                assertThatThrownBy(() -> tripService.createTrip(newTrip(v), EDITOR.getEmail()))
                        .as(v)
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage(TripService.BUDGET_DIGITS);
            }
        });
        verify(tripRepository, never()).save(any());
    }

    @Test
    void updateTripRejectsHugeBudgetsFastAndLeavesTheTripAlone() {
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
            for (String v : List.of("1e20000000", "1e-20000000")) {
                UpdateTripRequest r = new UpdateTripRequest();
                r.setBudget(new BigDecimal(v));
                assertThatThrownBy(() -> tripService.updateTrip(TRIP_ID, r, EDITOR.getEmail()))
                        .as(v)
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage(TripService.BUDGET_DIGITS);
            }
        });
        assertThat(trip.getBudget()).isEqualByComparingTo("3000.00");
        verify(tripRepository, never()).save(any());
    }

    @Test
    void budgetAllocationsRejectHugeExponentsFast() {
        assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
            assertThatThrownBy(() -> budgetService.updateBudgets(TRIP_ID,
                    List.of(new BudgetAllocationRequest(EDITOR.getId(), new BigDecimal("1e-20000000"))),
                    OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Budgets can have at most 2 decimal places");
            assertThatThrownBy(() -> budgetService.updateBudgets(TRIP_ID,
                    List.of(new BudgetAllocationRequest(EDITOR.getId(), new BigDecimal("1e20000000"))),
                    OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("That budget is too large");
        });
        verify(budgetRepository, never()).save(any());
        verify(budgetRepository, never()).deleteByTripIdAndUserIdNotIn(any(), any());
    }
}
