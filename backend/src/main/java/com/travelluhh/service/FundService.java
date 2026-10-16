package com.travelluhh.service;

import com.travelluhh.dto.fund.FundEntryRequest;
import com.travelluhh.dto.fund.FundEntryResponse;
import com.travelluhh.dto.fund.FundSummaryResponse;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripFundEntry;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripFundEntryRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.util.Decimals;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * The travel fund (table trip_fund_entries, API contract, Travel fund): money set aside for a trip,
 * in the trip currency. Members read; owner and editors add and delete. A negative amount is a
 * withdrawal and can't take the fund below zero; neither can deleting a deposit.
 *
 * Both writes check the balance and then write, so they first lock the trip row
 * (TripRepository.findByIdForUpdate). Parallel requests on the same trip then run one after the
 * other, and each balance check sees what the previous one committed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class FundService {

    static final String ENTRY_NOT_FOUND = "Fund entry not found";
    static final String DELETE_WOULD_GO_NEGATIVE =
            "Deleting this would leave the fund below zero. Remove the withdrawals first.";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final TripFundEntryRepository fundRepository;
    private final TripRepository tripRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    @Transactional(readOnly = true)
    public FundSummaryResponse getFund(Long tripId, String userEmail) {
        Trip trip = tripAccess.requireMember(tripId, userEmail);
        List<TripFundEntry> entries = fundRepository.findByTripIdNewestFirst(tripId);
        BigDecimal saved = entries.stream()
                .map(TripFundEntry::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        return FundSummaryResponse.builder()
                .target(trip.getBudget() != null ? trip.getBudget() : BigDecimal.ZERO)
                .saved(saved)
                .currency(trip.getCurrency())
                .entries(entries.stream().map(e -> FundEntryResponse.from(e, e.getUser())).toList())
                .build();
    }

    public FundEntryResponse addEntry(Long tripId, FundEntryRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        Trip trip = access.trip();

        BigDecimal amount = request.getAmount();
        if (amount == null) {
            throw new BadRequestException("Amount is required");
        }
        // Size checks before setScale, which would grind on something like 1e20000000.
        if (Decimals.fractionDigits(amount) > 2) {
            throw new BadRequestException("Amount can have at most 2 decimal places");
        }
        if (Decimals.integerDigits(amount) > 10) {
            throw new BadRequestException("Amount can have up to 10 digits and 2 decimal places");
        }
        amount = amount.setScale(2, RoundingMode.UNNECESSARY);
        if (amount.signum() == 0) {
            throw new BadRequestException("Amount can't be zero");
        }
        if (request.getEntryDate() == null) {
            throw new BadRequestException("Pick a date");
        }
        lockTrip(tripId);
        if (amount.signum() < 0) {
            BigDecimal saved = savedIn(tripId);
            if (saved.add(amount).signum() < 0) {
                throw new BadRequestException("That's more than the fund holds ("
                        + ExpenseService.formatMoney(saved, trip.getCurrency()) + ")");
            }
        }
        String note = request.getNote() == null || request.getNote().isBlank() ? null : request.getNote().trim();

        User actor = access.user();
        TripFundEntry entry = fundRepository.save(TripFundEntry.builder()
                .tripId(tripId)
                .userId(actor.getId())
                .amount(amount)
                .note(note)
                .entryDate(request.getEntryDate())
                .build());

        String name = TripAccessService.actorName(actor);
        String money = ExpenseService.formatMoney(amount.abs(), trip.getCurrency());
        logActivity(tripId, actor, "fund_added", amount.signum() > 0
                ? name + " put " + money + " in the tabung"
                : name + " took " + money + " out of the tabung");
        return FundEntryResponse.from(entry, actor);
    }

    public void deleteEntry(Long tripId, Long entryId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        if (entryId == null) {
            throw new NotFoundException(ENTRY_NOT_FOUND);
        }
        // Locked before the entry is read so a parallel delete of the same row waits, then sees it gone.
        lockTrip(tripId);
        TripFundEntry entry = fundRepository.findByIdAndTripId(entryId, tripId)
                .orElseThrow(() -> new NotFoundException(ENTRY_NOT_FOUND));
        // Removing a deposit lowers the balance; it must not drop below zero.
        if (entry.getAmount() != null && entry.getAmount().signum() > 0
                && savedIn(tripId).subtract(entry.getAmount()).signum() < 0) {
            throw new BadRequestException(DELETE_WOULD_GO_NEGATIVE);
        }
        fundRepository.delete(entry);

        User actor = access.user();
        String kind = entry.getAmount() != null && entry.getAmount().signum() < 0 ? "withdrawal" : "deposit";
        String date = entry.getEntryDate() != null ? " from " + DAY.format(entry.getEntryDate()) : "";
        logActivity(tripId, actor, "fund_deleted", TripAccessService.actorName(actor) + " removed the "
                + ExpenseService.formatMoney(entry.getAmount() != null ? entry.getAmount().abs() : null,
                        access.trip().getCurrency())
                + " " + kind + date);
    }

    /** Row-locks the trip until the transaction ends (see the class comment). */
    private void lockTrip(Long tripId) {
        tripRepository.findByIdForUpdate(tripId)
                .orElseThrow(() -> new NotFoundException(TripAccessService.TRIP_NOT_FOUND));
    }

    /** What the fund holds right now, from the committed rows (plus this transaction's own writes). */
    private BigDecimal savedIn(Long tripId) {
        BigDecimal saved = fundRepository.sumAmountByTripId(tripId);
        return saved != null ? saved : BigDecimal.ZERO;
    }

    private void logActivity(Long tripId, User actor, String type, String text) {
        try {
            activityService.log(tripId, actor.getId(), TripAccessService.actorName(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, tripId, e.getMessage());
        }
    }
}
