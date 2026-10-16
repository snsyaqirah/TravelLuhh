package com.travelluhh.service;

import com.travelluhh.dto.itinerary.ItineraryItemRequest;
import com.travelluhh.dto.itinerary.ItineraryItemResponse;
import com.travelluhh.entity.ItineraryItem;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.ItineraryItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ItineraryService {

    static final String ITEM_NOT_FOUND = "Itinerary item not found";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final ItineraryItemRepository itineraryItemRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    @Transactional(readOnly = true)
    public List<ItineraryItemResponse> getItems(Long tripId, String userEmail) {
        tripAccess.requireMember(tripId, userEmail);
        return itineraryItemRepository.findByTripIdOrderByItemDateAscStartTimeAscSortOrderAscIdAsc(tripId)
                .stream().map(ItineraryItemResponse::of).toList();
    }

    public ItineraryItemResponse addItem(Long tripId, ItineraryItemRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        validate(request, access.trip(), null);

        ItineraryItem item = ItineraryItem.builder().tripId(tripId).build();
        apply(item, request);
        item = itineraryItemRepository.save(item);

        logActivity(tripId, access.user(), "itinerary_added", TripAccessService.actorName(access.user())
                + " added " + quote(item.getTitle()) + " on " + DAY.format(item.getItemDate()));
        return ItineraryItemResponse.of(item);
    }

    /** PUT: replaces every field of an item that belongs to this trip. */
    public ItineraryItemResponse updateItem(Long tripId, Long itemId, ItineraryItemRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        ItineraryItem item = itineraryItemRepository.findByIdAndTripId(itemId, tripId)
                .orElseThrow(() -> new NotFoundException(ITEM_NOT_FOUND));
        validate(request, access.trip(), item.getItemDate());

        apply(item, request);
        item = itineraryItemRepository.saveAndFlush(item);

        logActivity(tripId, access.user(), "itinerary_updated",
                TripAccessService.actorName(access.user()) + " updated " + quote(item.getTitle()));
        return ItineraryItemResponse.of(item);
    }

    public void deleteItem(Long tripId, Long itemId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        ItineraryItem item = itineraryItemRepository.findByIdAndTripId(itemId, tripId)
                .orElseThrow(() -> new NotFoundException(ITEM_NOT_FOUND));
        itineraryItemRepository.delete(item);

        logActivity(tripId, access.user(), "itinerary_deleted",
                TripAccessService.actorName(access.user()) + " removed " + quote(item.getTitle()) + " from the plan");
    }

    private static void apply(ItineraryItem item, ItineraryItemRequest request) {
        item.setItemDate(request.getItemDate());
        item.setStartTime(request.getStartTime());
        item.setEndTime(request.getEndTime());
        item.setTitle(request.getTitle().trim());
        item.setDescription(blankToNull(request.getDescription()));
        item.setLocation(blankToNull(request.getLocation()));
        item.setCategory(blankToNull(request.getCategory()));
        if (request.getSortOrder() != null) {
            item.setSortOrder(request.getSortOrder());
        } else if (item.getSortOrder() == null) {
            item.setSortOrder(0);
        }
    }

    /**
     * End time can't precede start time, and the day must fall inside the trip. An item already
     * outside the trip (the dates moved later) can still be edited as long as its day is unchanged.
     */
    private static void validate(ItineraryItemRequest request, Trip trip, LocalDate currentDate) {
        if (request.getStartTime() != null && request.getEndTime() != null
                && request.getEndTime().isBefore(request.getStartTime())) {
            throw new BadRequestException("End time can't be before the start time");
        }
        LocalDate day = request.getItemDate();
        boolean outside = (trip.getStartDate() != null && day.isBefore(trip.getStartDate()))
                || (trip.getEndDate() != null && day.isAfter(trip.getEndDate()));
        if (outside && !day.equals(currentDate)) {
            throw new BadRequestException("Pick a day between " + DAY.format(trip.getStartDate())
                    + " and " + DAY.format(trip.getEndDate()));
        }
    }

    private void logActivity(Long tripId, User actor, String type, String text) {
        try {
            activityService.log(tripId, actor.getId(), TripAccessService.actorName(actor), type, text);
        } catch (RuntimeException e) {
            log.warn("Could not log {} for trip {}: {}", type, tripId, e.getMessage());
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String quote(String s) {
        String trimmed = s == null ? "" : s.trim();
        return "\"" + (trimmed.length() > 80 ? trimmed.substring(0, 77) + "..." : trimmed) + "\"";
    }
}
