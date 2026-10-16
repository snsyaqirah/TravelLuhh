package com.travelluhh.service;

import com.travelluhh.dto.fund.FundEntryRequest;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripFundEntry;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripFundEntryRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FundServiceTest {

    private static final long TRIP_ID = 9L;
    private static final long ENTRY_ID = 50L;
    private static final User OWNER = user(1L, "Aiman");
    private static final User EDITOR = user(2L, "Siti");
    private static final User VIEWER = user(3L, "Chong");

    @Mock private TripFundEntryRepository fundRepository;
    @Mock private TripRepository tripRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private UserRepository userRepository;
    @Mock private ActivityService activityService;

    private FundService service;
    private Trip trip;

    private static User user(long id, String name) {
        return User.builder().id(id).name(name).email(name.toLowerCase() + "@example.com").build();
    }

    @BeforeEach
    void setUp() {
        // The real access rules, backed by mocked repositories.
        TripAccessService access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        service = new FundService(fundRepository, tripRepository, access, activityService);

        trip = Trip.builder().id(TRIP_ID).ownerId(OWNER.getId()).currency("MYR").name("Tokyo autumn").build();
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.findByIdForUpdate(TRIP_ID)).thenReturn(Optional.of(trip));
        for (User u : List.of(OWNER, EDITOR, VIEWER)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        }
        when(tripMemberRepository.findRole(TRIP_ID, EDITOR.getId())).thenReturn(Optional.of(MemberRole.editor));
        when(tripMemberRepository.findRole(TRIP_ID, VIEWER.getId())).thenReturn(Optional.of(MemberRole.viewer));

        when(fundRepository.save(any(TripFundEntry.class))).thenAnswer(inv -> {
            TripFundEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(ENTRY_ID);
            return e;
        });
    }

    private static FundEntryRequest request(String amount) {
        return new FundEntryRequest(new BigDecimal(amount), LocalDate.of(2026, 10, 16), null);
    }

    private void balanceIs(String saved) {
        when(fundRepository.sumAmountByTripId(TRIP_ID)).thenReturn(new BigDecimal(saved));
    }

    private void entryExists(String amount) {
        TripFundEntry entry = TripFundEntry.builder().id(ENTRY_ID).tripId(TRIP_ID).userId(EDITOR.getId())
                .amount(new BigDecimal(amount)).entryDate(LocalDate.of(2026, 10, 1)).build();
        when(fundRepository.findByIdAndTripId(ENTRY_ID, TRIP_ID)).thenReturn(Optional.of(entry));
    }

    @Nested
    class Withdrawals {

        @Test
        void withdrawalLocksTheTripBeforeReadingTheBalanceAndWriting() {
            balanceIs("100.00");

            service.addEntry(TRIP_ID, request("-80"), EDITOR.getEmail());

            // Lock first, so a parallel withdrawal waits and then reads a balance that includes this one.
            InOrder order = inOrder(tripRepository, fundRepository);
            order.verify(tripRepository).findByIdForUpdate(TRIP_ID);
            order.verify(fundRepository).sumAmountByTripId(TRIP_ID);
            order.verify(fundRepository).save(any(TripFundEntry.class));
        }

        @Test
        void withdrawalMoreThanTheFundHoldsIsRejectedWithTheBalance() {
            balanceIs("2000.50");

            assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("-2000.51"), EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("That's more than the fund holds (MYR 2,000.50)");
            verify(fundRepository, never()).save(any());
        }

        @Test
        void secondWithdrawalSeesTheFirstAndIsRejected() {
            // What the lock buys: the second request reads the balance only after the first committed.
            when(fundRepository.sumAmountByTripId(TRIP_ID))
                    .thenReturn(new BigDecimal("100.00"))
                    .thenReturn(new BigDecimal("20.00"));

            service.addEntry(TRIP_ID, request("-80"), EDITOR.getEmail());
            assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("-80"), OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("That's more than the fund holds (MYR 20.00)");
            verify(fundRepository, times(1)).save(any());
        }

        @Test
        void withdrawingExactlyTheBalanceEmptiesTheFund() {
            balanceIs("100.00");

            service.addEntry(TRIP_ID, request("-100"), EDITOR.getEmail());

            ArgumentCaptor<TripFundEntry> captor = ArgumentCaptor.forClass(TripFundEntry.class);
            verify(fundRepository).save(captor.capture());
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("-100.00");
        }

        @Test
        void depositsTakeTheLockToo() {
            service.addEntry(TRIP_ID, request("50"), EDITOR.getEmail());

            verify(tripRepository).findByIdForUpdate(TRIP_ID);
            verify(fundRepository).save(any(TripFundEntry.class));
        }

        @Test
        void viewerCannotAddAndTakesNoLock() {
            assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("-10"), VIEWER.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
            verify(tripRepository, never()).findByIdForUpdate(anyLong());
        }
    }

    @Nested
    class Deletes {

        @Test
        void deletingADepositThatWouldLeaveTheFundBelowZeroIsRejected() {
            // Deposit 100, withdraw 80 → saved 20. Removing the deposit would leave -80.
            entryExists("100.00");
            balanceIs("20.00");

            assertThatThrownBy(() -> service.deleteEntry(TRIP_ID, ENTRY_ID, EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Deleting this would leave the fund below zero. Remove the withdrawals first.");
            verify(fundRepository, never()).delete(any());
            verify(activityService, never()).log(anyLong(), anyLong(), any(), any(), any());
        }

        @Test
        void deletingADepositThatLeavesZeroIsAllowed() {
            entryExists("100.00");
            balanceIs("100.00");

            service.deleteEntry(TRIP_ID, ENTRY_ID, EDITOR.getEmail());

            verify(fundRepository).delete(any(TripFundEntry.class));
            verify(activityService).log(eq(TRIP_ID), eq(EDITOR.getId()), eq("Siti"), eq("fund_deleted"),
                    eq("Siti removed the MYR 100.00 deposit from 1 Oct 2026"));
        }

        @Test
        void deletingAWithdrawalIsAlwaysAllowedEvenWhenTheFundIsAlreadyNegative() {
            entryExists("-80.00");
            balanceIs("-80.00");

            service.deleteEntry(TRIP_ID, ENTRY_ID, EDITOR.getEmail());

            verify(fundRepository).delete(any(TripFundEntry.class));
        }

        @Test
        void deleteLocksTheTripBeforeReadingTheEntryAndTheBalance() {
            entryExists("100.00");
            balanceIs("150.00");

            service.deleteEntry(TRIP_ID, ENTRY_ID, EDITOR.getEmail());

            InOrder order = inOrder(tripRepository, fundRepository);
            order.verify(tripRepository).findByIdForUpdate(TRIP_ID);
            order.verify(fundRepository).findByIdAndTripId(ENTRY_ID, TRIP_ID);
            order.verify(fundRepository).sumAmountByTripId(TRIP_ID);
            order.verify(fundRepository).delete(any(TripFundEntry.class));
        }

        @Test
        void missingEntryIsNotFound() {
            when(fundRepository.findByIdAndTripId(ENTRY_ID, TRIP_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteEntry(TRIP_ID, ENTRY_ID, EDITOR.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Fund entry not found");
        }
    }

    @Nested
    class AmountSize {

        @Test
        void hugeExponentsAreRejectedFastAndNeverReachTheDatabase() {
            assertTimeoutPreemptively(Duration.ofSeconds(2), () -> {
                assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("1e-20000000"), EDITOR.getEmail()))
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage("Amount can have at most 2 decimal places");
                assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("1e20000000"), EDITOR.getEmail()))
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage("Amount can have up to 10 digits and 2 decimal places");
                assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("-1e20000000"), EDITOR.getEmail()))
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage("Amount can have up to 10 digits and 2 decimal places");
                assertThatThrownBy(() -> service.addEntry(TRIP_ID, request("0e20000000"), EDITOR.getEmail()))
                        .isInstanceOf(BadRequestException.class)
                        .hasMessage("Amount can't be zero");
            });
            verify(tripRepository, never()).findByIdForUpdate(anyLong());
            verify(fundRepository, never()).save(any());
        }

        @Test
        void trailingZerosAreFineAndTheLargestAmountFits() {
            service.addEntry(TRIP_ID, request("12.5000"), EDITOR.getEmail());
            service.addEntry(TRIP_ID, request("9999999999.99"), EDITOR.getEmail());

            verify(fundRepository, times(2)).save(any(TripFundEntry.class));
        }
    }
}
