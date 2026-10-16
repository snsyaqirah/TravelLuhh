package com.travelluhh.service;

import com.travelluhh.dto.expense.CreateExpenseRequest;
import com.travelluhh.dto.expense.ExpenseResponse;
import com.travelluhh.entity.Expense;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.ExpenseSubItemRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExpenseServiceTest {

    private static final long TRIP_ID = 9L;
    private static final User OWNER = user(1L, "Aiman");
    private static final User EDITOR = user(2L, "Siti");
    private static final User VIEWER = user(3L, "Chong");
    private static final User STRANGER = user(4L, "Mei");

    @Mock private ExpenseRepository expenseRepository;
    @Mock private ExpenseSubItemRepository subItemRepository;
    @Mock private UserRepository userRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private TripRepository tripRepository;
    @Mock private ActivityService activityService;

    private ExpenseService service;
    private Trip trip;

    private static User user(long id, String name) {
        return User.builder().id(id).name(name).email(name.toLowerCase() + "@example.com").build();
    }

    @BeforeEach
    void setUp() {
        // The real access rules, backed by mocked repositories.
        TripAccessService access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        service = new ExpenseService(expenseRepository, subItemRepository, userRepository,
                tripMemberRepository, access, activityService);

        trip = Trip.builder().id(TRIP_ID).ownerId(OWNER.getId()).currency("MYR").name("Tokyo autumn").build();
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));

        for (User u : List.of(OWNER, EDITOR, VIEWER, STRANGER)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
        }
        when(userRepository.findAllById(any())).thenReturn(List.of(OWNER, EDITOR, VIEWER, STRANGER));

        when(tripMemberRepository.findRole(TRIP_ID, EDITOR.getId())).thenReturn(Optional.of(MemberRole.editor));
        when(tripMemberRepository.findRole(TRIP_ID, VIEWER.getId())).thenReturn(Optional.of(MemberRole.viewer));
        when(tripMemberRepository.findRole(eq(TRIP_ID), eq(STRANGER.getId()))).thenReturn(Optional.empty());
        when(tripMemberRepository.existsByTripIdAndUserId(eq(TRIP_ID), anyLong())).thenReturn(false);
        when(tripMemberRepository.existsByTripIdAndUserId(TRIP_ID, EDITOR.getId())).thenReturn(true);
        when(tripMemberRepository.existsByTripIdAndUserId(TRIP_ID, VIEWER.getId())).thenReturn(true);

        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> {
            Expense e = inv.getArgument(0);
            if (e.getId() == null) e.setId(100L);
            return e;
        });
        when(expenseRepository.saveAndFlush(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
        when(subItemRepository.saveAll(any())).thenAnswer(inv -> new ArrayList<>(inv.<List<?>>getArgument(0)));
        when(subItemRepository.findByExpenseId(anyLong())).thenReturn(List.of());
    }

    private static CreateExpenseRequest request(String amount, String currency) {
        CreateExpenseRequest r = new CreateExpenseRequest();
        r.setTripId(TRIP_ID);
        r.setDescription("Ramen Ichiran");
        r.setAmount(new BigDecimal(amount));
        r.setCurrency(currency);
        r.setCategory(Expense.ExpenseCategory.food);
        r.setExpenseDate(LocalDate.of(2026, 11, 2));
        return r;
    }

    private Expense savedExpense() {
        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(captor.capture());
        return captor.getValue();
    }

    @Nested
    class CurrencyRules {

        @Test
        void tripCurrencyExpenseFillsOriginalsWithTheAmount() {
            ExpenseResponse response = service.createExpense(request("40", "MYR"), EDITOR.getEmail());

            Expense saved = savedExpense();
            assertThat(saved.getAmount()).isEqualByComparingTo("40.00");
            assertThat(saved.getAmount().scale()).isEqualTo(2);
            assertThat(saved.getCurrency()).isEqualTo("MYR");
            assertThat(saved.getOriginalAmount()).isEqualByComparingTo("40.00");
            assertThat(saved.getOriginalCurrency()).isEqualTo("MYR");
            assertThat(saved.getConvertedAmount()).isEqualByComparingTo("40.00");
            assertThat(saved.getFxRate()).isNull();

            assertThat(response.getCurrency()).isEqualTo("MYR");
            assertThat(response.getOriginalAmount()).isEqualByComparingTo("40.00");
        }

        @Test
        void currencyCodesAreUpperCased() {
            service.createExpense(request("40", "myr"), EDITOR.getEmail());
            assertThat(savedExpense().getCurrency()).isEqualTo("MYR");
        }

        @Test
        void foreignCurrencyWithoutOriginalIsRejected() {
            assertThatThrownBy(() -> service.createExpense(request("3200", "JPY"), EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Convert to trip currency first");
            verify(expenseRepository, never()).save(any());
        }

        @Test
        void foreignOriginalCurrencyWithoutOriginalAmountIsRejected() {
            CreateExpenseRequest r = request("95.40", "MYR");
            r.setOriginalCurrency("JPY");
            assertThatThrownBy(() -> service.createExpense(r, EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Convert to trip currency first");
        }

        @Test
        void convertedExpenseKeepsWhatWasPaid() {
            CreateExpenseRequest r = request("95.40", "MYR");
            r.setOriginalAmount(new BigDecimal("3200"));
            r.setOriginalCurrency("jpy");
            r.setFxRate(new BigDecimal("0.029812499999"));

            ExpenseResponse response = service.createExpense(r, EDITOR.getEmail());

            Expense saved = savedExpense();
            assertThat(saved.getAmount()).isEqualByComparingTo("95.40");
            assertThat(saved.getCurrency()).isEqualTo("MYR");
            assertThat(saved.getConvertedAmount()).isEqualByComparingTo("95.40");
            assertThat(saved.getOriginalAmount()).isEqualByComparingTo("3200.00");
            assertThat(saved.getOriginalCurrency()).isEqualTo("JPY");
            assertThat(saved.getFxRate()).isEqualByComparingTo("0.02981250");
            assertThat(saved.getFxRate().scale()).isEqualTo(8);
            assertThat(response.getFxRate()).isEqualByComparingTo("0.02981250");
        }

        @Test
        void missingRateIsDerivedFromTheTwoAmounts() {
            CreateExpenseRequest r = request("95.40", "MYR");
            r.setOriginalAmount(new BigDecimal("3200"));
            r.setOriginalCurrency("JPY");

            service.createExpense(r, EDITOR.getEmail());

            assertThat(savedExpense().getFxRate()).isEqualByComparingTo("0.02981250");
        }

        @Test
        void requestCurrencyDoublesAsOriginalCurrency() {
            // amount is in the trip currency; currency names what was paid when originals are sent.
            CreateExpenseRequest r = request("95.40", "JPY");
            r.setOriginalAmount(new BigDecimal("3200"));

            service.createExpense(r, EDITOR.getEmail());

            Expense saved = savedExpense();
            assertThat(saved.getCurrency()).isEqualTo("MYR");
            assertThat(saved.getOriginalCurrency()).isEqualTo("JPY");
            assertThat(saved.getOriginalAmount()).isEqualByComparingTo("3200.00");
        }

        @Test
        void originalInTripCurrencyAlwaysEqualsTheAmount() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setOriginalAmount(new BigDecimal("55"));
            r.setOriginalCurrency("MYR");
            r.setFxRate(new BigDecimal("1.2"));

            service.createExpense(r, EDITOR.getEmail());

            Expense saved = savedExpense();
            assertThat(saved.getOriginalAmount()).isEqualByComparingTo("40.00");
            assertThat(saved.getFxRate()).isNull();
        }

        @Test
        void resolveMoneyFallsBackToRequestCurrencyForLegacyTripsWithoutOne() {
            ExpenseService.Money money = ExpenseService.resolveMoney(request("12.345", "sgd"), null);
            assertThat(money.currency()).isEqualTo("SGD");
            assertThat(money.amount()).isEqualByComparingTo("12.35");
            assertThat(money.originalCurrency()).isEqualTo("SGD");
        }
    }

    @Nested
    class SizeLimits {

        private CreateExpenseRequest converted(String fxRate) {
            CreateExpenseRequest r = request("95.40", "MYR");
            r.setOriginalAmount(new BigDecimal("3200"));
            r.setOriginalCurrency("JPY");
            r.setFxRate(fxRate != null ? new BigDecimal(fxRate) : null);
            return r;
        }

        private void rejectedFast(CreateExpenseRequest r, String message) {
            // Rounding 1e-20000000 to 8 places used to take ~10 s of CPU; the size check answers at once.
            assertTimeoutPreemptively(Duration.ofSeconds(2), () ->
                    assertThatThrownBy(() -> service.createExpense(r, EDITOR.getEmail()))
                            .isInstanceOf(BadRequestException.class)
                            .hasMessage(message));
            verify(expenseRepository, never()).save(any());
        }

        @Test
        void fxRateWithAHugeNegativeExponentIsRejectedFast() {
            rejectedFast(converted("1e-20000000"), ExpenseService.FX_RATE_DIGITS);
        }

        @Test
        void fxRateWithAHugePositiveExponentIsRejectedFast() {
            rejectedFast(converted("1e20000000"), ExpenseService.FX_RATE_DIGITS);
        }

        @Test
        void fxRateIsCheckedEvenWhenItWouldBeIgnored() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setFxRate(new BigDecimal("1e-20000000"));
            rejectedFast(r, ExpenseService.FX_RATE_DIGITS);
        }

        @Test
        void amountWithAHugeExponentIsRejectedFast() {
            rejectedFast(request("1e-20000000", "MYR"), ExpenseService.AMOUNT_DIGITS);
            rejectedFast(request("1e20000000", "MYR"), ExpenseService.AMOUNT_DIGITS);
        }

        @Test
        void originalAmountWithAHugeExponentIsRejectedFast() {
            CreateExpenseRequest r = converted("0.0298125");
            r.setOriginalAmount(new BigDecimal("1e-20000000"));
            rejectedFast(r, ExpenseService.ORIGINAL_AMOUNT_DIGITS);
            r.setOriginalAmount(new BigDecimal("1e20000000"));
            rejectedFast(r, ExpenseService.ORIGINAL_AMOUNT_DIGITS);
        }

        @Test
        void subItemAmountWithAHugeExponentIsRejectedBeforeAnythingIsSaved() {
            CreateExpenseRequest r = request("40", "MYR");
            CreateExpenseRequest.SubItemRequest sub = new CreateExpenseRequest.SubItemRequest();
            sub.setDescription("Gyoza");
            sub.setAmount(new BigDecimal("1e-20000000"));
            r.setSubItems(List.of(sub));
            rejectedFast(r, ExpenseService.SUB_ITEM_AMOUNT_DIGITS);
            verify(subItemRepository, never()).saveAll(any());
        }

        @Test
        void hugeExponentsAreRejectedOnEditToo() {
            Expense existing = Expense.builder()
                    .id(100L).trip(trip).addedBy(OWNER.getId()).paidBy(OWNER.getId())
                    .description("Ramen").amount(new BigDecimal("30.00")).currency("MYR")
                    .category(Expense.ExpenseCategory.food).expenseDate(LocalDate.of(2026, 11, 2))
                    .build();
            when(expenseRepository.findById(100L)).thenReturn(Optional.of(existing));

            assertTimeoutPreemptively(Duration.ofSeconds(2), () ->
                    assertThatThrownBy(() -> service.updateExpense(100L, converted("1e-20000000"), EDITOR.getEmail()))
                            .isInstanceOf(BadRequestException.class)
                            .hasMessage(ExpenseService.FX_RATE_DIGITS));
            verify(expenseRepository, never()).saveAndFlush(any());
            assertThat(existing.getAmount()).isEqualByComparingTo("30.00");
        }

        @Test
        void clientRatesWithEightSignificantDigitsAreAccepted() {
            // The client sends Number(rate.toPrecision(8)): 9 decimals for JPY to MYR.
            service.createExpense(converted("0.030854674"), EDITOR.getEmail());
            assertThat(savedExpense().getFxRate()).isEqualByComparingTo("0.03085467");
        }

        @Test
        void sixteenDecimalsIsTheMostARateMayCarry() {
            assertThat(ExpenseService.resolveMoney(converted("0.0000000123456789"), "MYR").fxRate())
                    .isEqualByComparingTo("0.00000001");
            assertThatThrownBy(() -> ExpenseService.resolveMoney(converted("0.00000001234567891"), "MYR"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage(ExpenseService.FX_RATE_DIGITS);
            assertThatThrownBy(() -> ExpenseService.resolveMoney(converted("12345678901"), "MYR"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage(ExpenseService.FX_RATE_DIGITS);
        }

        @Test
        void trailingZerosDoNotCountAsDecimals() {
            service.createExpense(request("40.000000000", "MYR"), EDITOR.getEmail());
            assertThat(savedExpense().getAmount()).isEqualByComparingTo("40.00");
        }
    }

    @Nested
    class PayerAndRoles {

        @Test
        void payerDefaultsToTheCaller() {
            ExpenseResponse response = service.createExpense(request("40", "MYR"), EDITOR.getEmail());

            Expense saved = savedExpense();
            assertThat(saved.getAddedBy()).isEqualTo(EDITOR.getId());
            assertThat(saved.getPaidBy()).isEqualTo(EDITOR.getId());
            assertThat(response.getPaidBy()).isEqualTo(EDITOR.getId());
            assertThat(response.getPaidByUser().getName()).isEqualTo("Siti");
            assertThat(response.getAddedByUser().getName()).isEqualTo("Siti");
        }

        @Test
        void payerCanBeAnotherMemberOrTheOwner() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setPaidBy(OWNER.getId());
            service.createExpense(r, EDITOR.getEmail());
            assertThat(savedExpense().getPaidBy()).isEqualTo(OWNER.getId());
        }

        @Test
        void payerMustBeOnTheTrip() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setPaidBy(STRANGER.getId());
            assertThatThrownBy(() -> service.createExpense(r, EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Paid by must be someone on this trip");
        }

        @Test
        void viewerCannotAddExpenses() {
            assertThatThrownBy(() -> service.createExpense(request("40", "MYR"), VIEWER.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
            verify(expenseRepository, never()).save(any());
        }

        @Test
        void nonMemberCannotSeeTheTrip() {
            assertThatThrownBy(() -> service.createExpense(request("40", "MYR"), STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Trip not found");
            assertThatThrownBy(() -> service.getExpensesByTrip(TRIP_ID, STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    @Nested
    class Updates {

        private Expense existing;

        @BeforeEach
        void existingExpense() {
            existing = Expense.builder()
                    .id(100L).trip(trip).addedBy(OWNER.getId()).paidBy(null)
                    .description("Ramen").amount(new BigDecimal("30.00")).currency("MYR")
                    .originalAmount(new BigDecimal("30.00")).originalCurrency("MYR")
                    .convertedAmount(new BigDecimal("30.00"))
                    .category(Expense.ExpenseCategory.food).expenseDate(LocalDate.of(2026, 11, 2))
                    .build();
            when(expenseRepository.findById(100L)).thenReturn(Optional.of(existing));
        }

        @Test
        void editReplacesFieldsAndKeepsPayerWhenOmitted() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setTripId(null);

            ExpenseResponse response = service.updateExpense(100L, r, EDITOR.getEmail());

            assertThat(existing.getAmount()).isEqualByComparingTo("40.00");
            assertThat(existing.getOriginalAmount()).isEqualByComparingTo("40.00");
            assertThat(existing.getDescription()).isEqualTo("Ramen Ichiran");
            assertThat(existing.getPaidBy()).isNull();
            // Legacy rows without paid_by report the person who logged them.
            assertThat(response.getPaidBy()).isEqualTo(OWNER.getId());
            verify(subItemRepository, never()).deleteByExpenseId(anyLong());
            verify(activityService).log(eq(TRIP_ID), eq(EDITOR.getId()), eq("Siti"), eq("expense_updated"), anyString());
        }

        @Test
        void sentSubItemsReplaceTheOldOnes() {
            CreateExpenseRequest r = request("40", "MYR");
            CreateExpenseRequest.SubItemRequest sub = new CreateExpenseRequest.SubItemRequest();
            sub.setDescription("Gyoza");
            sub.setAmount(new BigDecimal("10"));
            r.setSubItems(List.of(sub));

            ExpenseResponse response = service.updateExpense(100L, r, EDITOR.getEmail());

            verify(subItemRepository).deleteByExpenseId(100L);
            assertThat(response.getSubItems()).hasSize(1);
            assertThat(response.getSubItems().get(0).getAmount()).isEqualByComparingTo("10.00");
        }

        @Test
        void expenseCannotMoveToAnotherTrip() {
            CreateExpenseRequest r = request("40", "MYR");
            r.setTripId(77L);
            assertThatThrownBy(() -> service.updateExpense(100L, r, EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("An expense can't move to another trip");
        }

        @Test
        void nonMemberSeesExpenseNotFound() {
            assertThatThrownBy(() -> service.updateExpense(100L, request("40", "MYR"), STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Expense not found");
            assertThatThrownBy(() -> service.deleteExpense(100L, STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Expense not found");
        }

        @Test
        void viewerCannotEditOrDelete() {
            assertThatThrownBy(() -> service.updateExpense(100L, request("40", "MYR"), VIEWER.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
            assertThatThrownBy(() -> service.deleteExpense(100L, VIEWER.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void resendingTheCurrentPayerWorksAfterTheyLeftTheTrip() {
            // STRANGER paid, then left: no trip_members row any more.
            existing.setPaidBy(STRANGER.getId());
            CreateExpenseRequest r = request("45", "MYR");
            r.setPaidBy(STRANGER.getId());

            ExpenseResponse response = service.updateExpense(100L, r, EDITOR.getEmail());

            assertThat(existing.getPaidBy()).isEqualTo(STRANGER.getId());
            assertThat(existing.getAmount()).isEqualByComparingTo("45.00");
            assertThat(response.getPaidBy()).isEqualTo(STRANGER.getId());
            verify(expenseRepository).saveAndFlush(existing);
        }

        @Test
        void resendingTheEffectivePayerOfALegacyRowKeepsItUnchanged() {
            // Legacy row: no paid_by, so the response reported addedBy as the payer; that person left.
            existing.setAddedBy(STRANGER.getId());
            CreateExpenseRequest r = request("45", "MYR");
            r.setPaidBy(STRANGER.getId());

            ExpenseResponse response = service.updateExpense(100L, r, EDITOR.getEmail());

            assertThat(existing.getPaidBy()).isNull();
            assertThat(response.getPaidBy()).isEqualTo(STRANGER.getId());
        }

        @Test
        void switchingThePayerToSomeoneOffTheTripIsStillRejected() {
            existing.setPaidBy(EDITOR.getId());
            CreateExpenseRequest r = request("45", "MYR");
            r.setPaidBy(STRANGER.getId());

            assertThatThrownBy(() -> service.updateExpense(100L, r, EDITOR.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Paid by must be someone on this trip");
            verify(expenseRepository, never()).saveAndFlush(any());
        }

        @Test
        void switchingThePayerToAnotherMemberStillWorks() {
            existing.setPaidBy(STRANGER.getId());
            CreateExpenseRequest r = request("45", "MYR");
            r.setPaidBy(VIEWER.getId());

            service.updateExpense(100L, r, EDITOR.getEmail());

            assertThat(existing.getPaidBy()).isEqualTo(VIEWER.getId());
        }

        @Test
        void editorCanDeleteAnExpenseWhoseAuthorWasDeleted() {
            existing.setAddedBy(null);
            service.deleteExpense(100L, EDITOR.getEmail());
            verify(expenseRepository).delete(existing);
        }
    }
}
