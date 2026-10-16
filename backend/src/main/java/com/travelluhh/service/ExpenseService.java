package com.travelluhh.service;

import com.travelluhh.dto.expense.CreateExpenseRequest;
import com.travelluhh.dto.expense.ExpenseResponse;
import com.travelluhh.entity.Expense;
import com.travelluhh.entity.ExpenseSubItem;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.ExpenseRepository;
import com.travelluhh.repository.ExpenseSubItemRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Expenses are stored in the trip currency so trg_update_trip_spent can sum them as-is.
 * The trigger also keeps trips.spent_amount current after every insert/update/delete here;
 * nothing in this service reads the Trip's spent columns after a mutation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    static final String EXPENSE_NOT_FOUND = "Expense not found";
    static final String CONVERT_FIRST = "Convert to trip currency first";

    private final ExpenseRepository expenseRepository;
    private final ExpenseSubItemRepository subItemRepository;
    private final UserRepository userRepository;
    private final TripMemberRepository tripMemberRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    // ── Commands ─────────────────────────────────────────────────────────────

    public ExpenseResponse createExpense(CreateExpenseRequest request, String userEmail) {
        User user = tripAccess.currentUser(userEmail);
        Trip trip = tripAccess.requireEditor(request.getTripId(), user);

        Money money = resolveMoney(request, trip.getCurrency());
        Long paidBy = request.getPaidBy() != null ? requireMemberPayer(trip, request.getPaidBy()) : user.getId();

        Expense expense = Expense.builder()
                .trip(trip)
                .addedBy(user.getId())
                .paidBy(paidBy)
                .description(request.getDescription().trim())
                .category(request.getCategory())
                .expenseDate(request.getExpenseDate())
                .notes(blankToNull(request.getNotes()))
                .build();
        money.applyTo(expense);
        expense = expenseRepository.save(expense);

        List<ExpenseSubItem> subItems = saveSubItems(expense.getId(), request.getSubItems());

        Map<Long, User> users = usersById(List.of(expense));
        logActivity(trip.getId(), user, "expense_added", addedText(user, expense, users));
        return toResponse(expense, subItems, users);
    }

    /** PUT semantics: every field is replaced, except paidBy (omitted keeps the payer) and subItems (null keeps them). */
    public ExpenseResponse updateExpense(Long expenseId, CreateExpenseRequest request, String userEmail) {
        User user = tripAccess.currentUser(userEmail);
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new NotFoundException(EXPENSE_NOT_FOUND));
        Long tripId = expense.getTrip().getId();
        Trip trip = tripAccess.require(tripId, user, MemberRole.editor, EXPENSE_NOT_FOUND).trip();

        if (request.getTripId() != null && !request.getTripId().equals(tripId)) {
            throw new BadRequestException("An expense can't move to another trip");
        }

        Money money = resolveMoney(request, trip.getCurrency());
        Long paidBy = request.getPaidBy() != null
                ? requireMemberPayer(trip, request.getPaidBy())
                : expense.getPaidBy();

        Snapshot before = Snapshot.of(expense);
        expense.setDescription(request.getDescription().trim());
        expense.setCategory(request.getCategory());
        expense.setExpenseDate(request.getExpenseDate());
        expense.setNotes(blankToNull(request.getNotes()));
        expense.setPaidBy(paidBy);
        money.applyTo(expense);
        expense = expenseRepository.saveAndFlush(expense);

        List<ExpenseSubItem> subItems;
        if (request.getSubItems() != null) {
            subItemRepository.deleteByExpenseId(expense.getId());
            subItems = saveSubItems(expense.getId(), request.getSubItems());
        } else {
            subItems = subItemRepository.findByExpenseId(expense.getId());
        }

        Map<Long, User> users = usersById(List.of(expense));
        logActivity(tripId, user, "expense_updated", updatedText(user, before, expense, users));
        return toResponse(expense, subItems, users);
    }

    public void deleteExpense(Long expenseId, String userEmail) {
        User user = tripAccess.currentUser(userEmail);
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new NotFoundException(EXPENSE_NOT_FOUND));
        Long tripId = expense.getTrip().getId();
        tripAccess.require(tripId, user, MemberRole.editor, EXPENSE_NOT_FOUND);

        String text = displayName(user) + " removed " + quote(expense.getDescription())
                + " (" + formatMoney(expense.getAmount(), expense.getCurrency()) + ")";
        expenseRepository.delete(expense);
        logActivity(tripId, user, "expense_deleted", text);
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExpenseResponse> getExpensesByTrip(Long tripId, String userEmail) {
        tripAccess.requireMember(tripId, userEmail);
        List<Expense> expenses = expenseRepository.findLedger(tripId);
        if (expenses.isEmpty()) {
            return List.of();
        }

        // Three queries for the whole ledger: expenses, sub-items, users.
        List<Long> ids = expenses.stream().map(Expense::getId).toList();
        Map<Long, List<ExpenseSubItem>> subItems = subItemRepository.findByExpenseIdInOrderByIdAsc(ids).stream()
                .collect(Collectors.groupingBy(ExpenseSubItem::getExpenseId));
        Map<Long, User> users = usersById(expenses);

        return expenses.stream()
                .map(e -> toResponse(e, subItems.getOrDefault(e.getId(), List.of()), users))
                .toList();
    }

    // ── Money rules ──────────────────────────────────────────────────────────

    /** What gets stored. amount/currency are always in the trip currency. */
    record Money(BigDecimal amount, String currency, BigDecimal originalAmount,
                 String originalCurrency, BigDecimal fxRate) {

        void applyTo(Expense expense) {
            expense.setAmount(amount);
            expense.setCurrency(currency);
            expense.setConvertedAmount(amount);
            expense.setOriginalAmount(originalAmount);
            expense.setOriginalCurrency(originalCurrency);
            expense.setFxRate(fxRate);
        }
    }

    /**
     * Contract rules (API.md, Expenses):
     * - amount is in the trip currency; the stored currency is always the trip currency.
     * - No originalAmount: currency must be the trip currency (else 400 "Convert to trip currency
     *   first") and the original is the amount itself.
     * - originalAmount given: originalCurrency defaults to the request currency. If that is the trip
     *   currency the original is the amount itself; otherwise fxRate is kept (8 dp) or derived as
     *   amount / originalAmount.
     */
    static Money resolveMoney(CreateExpenseRequest request, String tripCurrencyRaw) {
        String requestCurrency = upper(request.getCurrency());
        // Legacy trips may have no currency; then the request's currency is the trip currency.
        String tripCurrency = upper(tripCurrencyRaw) != null ? upper(tripCurrencyRaw) : requestCurrency;
        if (tripCurrency == null) {
            throw new BadRequestException("Currency is required");
        }
        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) {
            throw new BadRequestException("Amount must be greater than 0");
        }

        String originalCurrency = upper(request.getOriginalCurrency());
        if (request.getOriginalAmount() == null) {
            boolean foreign = !tripCurrency.equals(requestCurrency)
                    || (originalCurrency != null && !tripCurrency.equals(originalCurrency));
            if (foreign) {
                throw new BadRequestException(CONVERT_FIRST);
            }
            return new Money(amount, tripCurrency, amount, tripCurrency, null);
        }

        if (originalCurrency == null) {
            originalCurrency = requestCurrency;
        }
        if (tripCurrency.equals(originalCurrency)) {
            return new Money(amount, tripCurrency, amount, tripCurrency, null);
        }

        BigDecimal original = request.getOriginalAmount().setScale(2, RoundingMode.HALF_UP);
        if (original.signum() <= 0) {
            throw new BadRequestException("Original amount must be greater than 0");
        }
        BigDecimal fxRate = request.getFxRate() != null
                ? request.getFxRate().setScale(8, RoundingMode.HALF_UP)
                : amount.divide(original, 8, RoundingMode.HALF_UP);
        if (fxRate.signum() <= 0) {
            throw new BadRequestException("Exchange rate must be greater than 0");
        }
        return new Money(amount, tripCurrency, original, originalCurrency, fxRate);
    }

    /** paidBy must be the owner or someone with a trip_members row. */
    private Long requireMemberPayer(Trip trip, Long paidBy) {
        if (Objects.equals(paidBy, trip.getOwnerId())
                || tripMemberRepository.existsByTripIdAndUserId(trip.getId(), paidBy)) {
            return paidBy;
        }
        throw new BadRequestException("Paid by must be someone on this trip");
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private List<ExpenseSubItem> saveSubItems(Long expenseId, List<CreateExpenseRequest.SubItemRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        List<ExpenseSubItem> subItems = requests.stream()
                .map(s -> ExpenseSubItem.builder()
                        .expenseId(expenseId)
                        .description(s.getDescription().trim())
                        .amount(s.getAmount().setScale(2, RoundingMode.HALF_UP))
                        .category(s.getCategory())
                        .build())
                .collect(Collectors.toCollection(ArrayList::new));
        return subItemRepository.saveAll(subItems);
    }

    private Map<Long, User> usersById(Collection<Expense> expenses) {
        Set<Long> ids = new HashSet<>();
        for (Expense e : expenses) {
            if (e.getAddedBy() != null) ids.add(e.getAddedBy());
            if (e.effectivePayerId() != null) ids.add(e.effectivePayerId());
        }
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private ExpenseResponse toResponse(Expense e, List<ExpenseSubItem> subItems, Map<Long, User> users) {
        Long payerId = e.effectivePayerId();
        return ExpenseResponse.builder()
                .id(e.getId())
                .tripId(e.getTrip().getId())
                .description(e.getDescription())
                .amount(e.getAmount())
                .currency(e.getCurrency())
                .originalAmount(e.getOriginalAmount())
                .originalCurrency(e.getOriginalCurrency())
                .fxRate(e.getFxRate())
                .category(e.getCategory())
                .expenseDate(e.getExpenseDate())
                .notes(e.getNotes())
                .addedBy(e.getAddedBy())
                .addedByUser(ExpenseResponse.UserRef.of(e.getAddedBy() != null ? users.get(e.getAddedBy()) : null))
                .paidBy(payerId)
                .paidByUser(ExpenseResponse.UserRef.of(payerId != null ? users.get(payerId) : null))
                .subItems(subItems.stream()
                        .map(s -> ExpenseResponse.SubItemDto.builder()
                                .id(s.getId())
                                .description(s.getDescription())
                                .amount(s.getAmount())
                                .category(s.getCategory())
                                .build())
                        .toList())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    // ── Activity feed ────────────────────────────────────────────────────────

    /** Fields shown in the "expense_updated" diff, captured before the edit. */
    private record Snapshot(String description, BigDecimal amount, String currency,
                            Expense.ExpenseCategory category, LocalDate date, Long payerId) {
        static Snapshot of(Expense e) {
            return new Snapshot(e.getDescription(), e.getAmount(), e.getCurrency(), e.getCategory(),
                    e.getExpenseDate(), e.effectivePayerId());
        }
    }

    private String addedText(User actor, Expense e, Map<Long, User> users) {
        StringBuilder text = new StringBuilder(displayName(actor))
                .append(" added ").append(formatMoney(e.getAmount(), e.getCurrency()))
                .append(" for ").append(quote(e.getDescription()));
        if (!Objects.equals(e.getOriginalCurrency(), e.getCurrency())) {
            text.append(" (paid ").append(formatMoney(e.getOriginalAmount(), e.getOriginalCurrency())).append(")");
        }
        if (!Objects.equals(e.effectivePayerId(), actor.getId())) {
            text.append(", paid by ").append(displayName(users.get(e.effectivePayerId())));
        }
        return text.toString();
    }

    private String updatedText(User actor, Snapshot before, Expense after, Map<Long, User> users) {
        List<String> changes = new ArrayList<>();
        if (!Objects.equals(before.description(), after.getDescription())) {
            changes.add("name " + quote(before.description()) + " to " + quote(after.getDescription()));
        }
        if (before.amount() == null || before.amount().compareTo(after.getAmount()) != 0
                || !Objects.equals(before.currency(), after.getCurrency())) {
            changes.add("amount " + formatMoney(before.amount(), before.currency())
                    + " to " + formatMoney(after.getAmount(), after.getCurrency()));
        }
        if (before.category() != after.getCategory()) {
            changes.add("category " + before.category() + " to " + after.getCategory());
        }
        if (!Objects.equals(before.date(), after.getExpenseDate())) {
            changes.add("date " + before.date() + " to " + after.getExpenseDate());
        }
        if (!Objects.equals(before.payerId(), after.effectivePayerId())) {
            changes.add("paid by " + displayName(users.get(after.effectivePayerId())));
        }
        String text = displayName(actor) + " edited " + quote(after.getDescription());
        return changes.isEmpty() ? text : text + ": " + String.join(", ", changes);
    }

    private void logActivity(Long tripId, User actor, String type, String text) {
        // The feed must never break the money path, so failures are logged and swallowed.
        try {
            activityService.log(tripId, actor.getId(), displayName(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, tripId, e.getMessage());
        }
    }

    // ── Small helpers ────────────────────────────────────────────────────────

    static String upper(String code) {
        if (code == null || code.isBlank()) return null;
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String displayName(User user) {
        return TripAccessService.actorName(user);
    }

    private static String quote(String s) {
        if (s == null || s.isBlank()) return "an expense";
        String trimmed = s.trim();
        return "\"" + (trimmed.length() > 80 ? trimmed.substring(0, 77) + "..." : trimmed) + "\"";
    }

    static String formatMoney(BigDecimal amount, String currency) {
        if (amount == null) return "nothing";
        return String.format(Locale.ROOT, "%s %,.2f", currency != null ? currency : "", amount).trim();
    }
}
