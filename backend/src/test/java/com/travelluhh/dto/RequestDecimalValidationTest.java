package com.travelluhh.dto;

import com.travelluhh.dto.budget.BudgetAllocationRequest;
import com.travelluhh.dto.expense.CreateExpenseRequest;
import com.travelluhh.dto.fund.FundEntryRequest;
import com.travelluhh.dto.trip.CreateTripRequest;
import com.travelluhh.dto.trip.UpdateTripRequest;
import com.travelluhh.entity.Expense;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

/**
 * Every BigDecimal a client can send is bounded by @Digits, so sizes like 1e-20000000 or 1e20000000
 * become a 400 during binding, before any service code rounds them.
 */
class RequestDecimalValidationTest {

    private static final List<String> HUGE = List.of("1e-20000000", "1e20000000");

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static CreateExpenseRequest expense() {
        CreateExpenseRequest r = new CreateExpenseRequest();
        r.setTripId(9L);
        r.setDescription("Ramen Ichiran");
        r.setAmount(new BigDecimal("95.40"));
        r.setCurrency("MYR");
        r.setCategory(Expense.ExpenseCategory.food);
        r.setExpenseDate(LocalDate.of(2026, 11, 2));
        r.setOriginalAmount(new BigDecimal("3200"));
        r.setOriginalCurrency("JPY");
        return r;
    }

    private static List<String> fieldsInError(Set<? extends ConstraintViolation<?>> violations) {
        return violations.stream().map(v -> v.getPropertyPath().toString()).distinct().toList();
    }

    @Test
    void fxRateRejectsHugeExponentsQuickly() {
        assertTimeoutPreemptively(Duration.ofSeconds(1), () -> {
            for (String v : HUGE) {
                CreateExpenseRequest r = expense();
                r.setFxRate(new BigDecimal(v));
                assertThat(fieldsInError(validator.validate(r))).as(v).containsExactly("fxRate");
            }
        });
    }

    @Test
    void fxRateAcceptsWhatTheClientSends() {
        // Number(rate.toPrecision(8)) for JPY to MYR, VND to MYR and MYR to IDR.
        for (String v : List.of("0.030854674", "0.00017234567", "3456.7891", "0.0000000123456789")) {
            CreateExpenseRequest r = expense();
            r.setFxRate(new BigDecimal(v));
            assertThat(validator.validate(r)).as(v).isEmpty();
        }
        CreateExpenseRequest tooLong = expense();
        tooLong.setFxRate(new BigDecimal("0.00000001234567891"));
        assertThat(fieldsInError(validator.validate(tooLong))).containsExactly("fxRate");
    }

    @Test
    void moneyFieldsRejectHugeExponentsQuickly() {
        assertTimeoutPreemptively(Duration.ofSeconds(1), () -> {
            for (String v : HUGE) {
                BigDecimal huge = new BigDecimal(v);

                CreateExpenseRequest amount = expense();
                amount.setAmount(huge);
                assertThat(fieldsInError(validator.validate(amount))).as(v).containsExactly("amount");

                CreateExpenseRequest original = expense();
                original.setOriginalAmount(huge);
                assertThat(fieldsInError(validator.validate(original))).as(v).containsExactly("originalAmount");

                CreateExpenseRequest withSub = expense();
                CreateExpenseRequest.SubItemRequest sub = new CreateExpenseRequest.SubItemRequest();
                sub.setDescription("Gyoza");
                sub.setAmount(huge);
                withSub.setSubItems(List.of(sub));
                assertThat(fieldsInError(validator.validate(withSub))).as(v).containsExactly("subItems[0].amount");

                FundEntryRequest fund = new FundEntryRequest(huge, LocalDate.of(2026, 10, 16), null);
                assertThat(fieldsInError(validator.validate(fund))).as(v).containsExactly("amount");

                UpdateTripRequest update = new UpdateTripRequest();
                update.setBudget(huge);
                assertThat(fieldsInError(validator.validate(update))).as(v).containsExactly("budget");

                CreateTripRequest create = new CreateTripRequest();
                create.setBudget(huge);
                assertThat(fieldsInError(validator.validate(create))).as(v).contains("budget");

                BudgetAllocationRequest allocation = new BudgetAllocationRequest(2L, huge);
                assertThat(fieldsInError(validator.validate(allocation))).as(v).containsExactly("allocated");
            }
        });
    }
}
