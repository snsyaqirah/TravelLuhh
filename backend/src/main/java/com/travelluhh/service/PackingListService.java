package com.travelluhh.service;

import com.travelluhh.dto.packing.PackingItemRequest;
import com.travelluhh.dto.packing.PackingItemResponse;
import com.travelluhh.entity.PackingItem;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.PackingItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PackingListService {

    static final String ITEM_NOT_FOUND = "Packing item not found";

    private record PresetItem(String label, String category) {}

    /** Keyed by the preset ids the API accepts. Labels are plain text: no emoji. */
    private static final Map<String, List<PresetItem>> PRESETS = buildPresets();

    private final PackingItemRepository packingItemRepository;
    private final TripAccessService tripAccess;
    private final ActivityService activityService;

    @Transactional(readOnly = true)
    public List<PackingItemResponse> getItems(Long tripId, String userEmail) {
        tripAccess.requireMember(tripId, userEmail);
        return packingItemRepository.findByTripIdOrderByCreatedAtAscIdAsc(tripId)
                .stream().map(PackingItemResponse::of).toList();
    }

    public PackingItemResponse addItem(Long tripId, PackingItemRequest request, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        PackingItem item = packingItemRepository.save(PackingItem.builder()
                .tripId(tripId)
                .addedBy(access.user().getId())
                .label(request.getLabel().trim())
                .category(blankToNull(request.getCategory()))
                .isChecked(false)
                .build());

        logActivity(tripId, access.user(), "packing_added", TripAccessService.actorName(access.user())
                + " added " + quote(item.getLabel()) + " to the packing list");
        return PackingItemResponse.of(item);
    }

    /** Flips is_checked and returns the updated item. */
    public PackingItemResponse toggleItem(Long tripId, Long itemId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        PackingItem item = findItem(tripId, itemId);
        boolean checked = !Boolean.TRUE.equals(item.getIsChecked());
        item.setIsChecked(checked);
        item = packingItemRepository.saveAndFlush(item);

        String actor = TripAccessService.actorName(access.user());
        logActivity(tripId, access.user(), checked ? "packing_checked" : "packing_unchecked",
                actor + (checked ? " packed " : " unpacked ") + quote(item.getLabel()));
        return PackingItemResponse.of(item);
    }

    public void deleteItem(Long tripId, Long itemId, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        PackingItem item = findItem(tripId, itemId);
        packingItemRepository.delete(item);

        logActivity(tripId, access.user(), "packing_deleted", TripAccessService.actorName(access.user())
                + " removed " + quote(item.getLabel()) + " from the packing list");
    }

    /**
     * Adds a preset list (general | beach | hiking | business | umrah; "hajj" is accepted for umrah).
     * Items whose label is already on the list are skipped. Returns only the items added.
     */
    public List<PackingItemResponse> addPreset(Long tripId, String preset, String userEmail) {
        TripAccessService.Access access = tripAccess.access(tripId, userEmail, MemberRole.editor);
        String key = presetKey(preset);

        Set<String> existing = new HashSet<>(packingItemRepository.findLowerLabelsByTripId(tripId));
        List<PackingItem> items = PRESETS.get(key).stream()
                .filter(p -> existing.add(p.label().toLowerCase(Locale.ROOT)))
                .map(p -> PackingItem.builder()
                        .tripId(tripId)
                        .addedBy(access.user().getId())
                        .label(p.label())
                        .category(p.category())
                        .isChecked(false)
                        .build())
                .toList();
        if (items.isEmpty()) {
            return List.of();
        }

        List<PackingItemResponse> added = packingItemRepository.saveAll(items).stream()
                .map(PackingItemResponse::of).toList();
        logActivity(tripId, access.user(), "packing_preset", TripAccessService.actorName(access.user())
                + " added " + added.size() + (added.size() == 1 ? " item" : " items") + " from the " + key + " list");
        return added;
    }

    private PackingItem findItem(Long tripId, Long itemId) {
        return packingItemRepository.findByIdAndTripId(itemId, tripId)
                .orElseThrow(() -> new NotFoundException(ITEM_NOT_FOUND));
    }

    static String presetKey(String preset) {
        String key = preset == null || preset.isBlank() ? "general" : preset.trim().toLowerCase(Locale.ROOT);
        if ("hajj".equals(key)) {
            key = "umrah";
        }
        if (!PRESETS.containsKey(key)) {
            throw new BadRequestException("Unknown preset. Pick general, beach, hiking, business or umrah.");
        }
        return key;
    }

    private static Map<String, List<PresetItem>> buildPresets() {
        Map<String, List<PresetItem>> presets = new LinkedHashMap<>();
        presets.put("general", List.of(
                new PresetItem("Passport & documents", "documents"), new PresetItem("Phone charger", "electronics"),
                new PresetItem("Medications", "health"), new PresetItem("Clothes", "clothing"),
                new PresetItem("Toiletries", "personal"), new PresetItem("Travel adapter", "electronics"),
                new PresetItem("Power bank", "electronics"), new PresetItem("Snacks", "food")));
        presets.put("beach", List.of(
                new PresetItem("Sunscreen SPF 50+", "health"), new PresetItem("Swimwear", "clothing"),
                new PresetItem("Beach towel", "gear"), new PresetItem("Flip flops", "clothing"),
                new PresetItem("Sunglasses", "clothing"), new PresetItem("Snorkeling gear", "gear"),
                new PresetItem("Waterproof bag", "gear"), new PresetItem("After-sun lotion", "health")));
        presets.put("hiking", List.of(
                new PresetItem("Hiking boots", "clothing"), new PresetItem("Backpack", "gear"),
                new PresetItem("Water bottle", "gear"), new PresetItem("First aid kit", "health"),
                new PresetItem("Sunscreen", "health"), new PresetItem("Trail map / GPS", "gear"),
                new PresetItem("Raincoat", "clothing"), new PresetItem("Headlamp", "gear"),
                new PresetItem("Energy snacks", "food"), new PresetItem("Trekking poles", "gear")));
        presets.put("business", List.of(
                new PresetItem("Business cards", "work"), new PresetItem("Laptop + charger", "electronics"),
                new PresetItem("Formal attire", "clothing"), new PresetItem("Notebook & pen", "work"),
                new PresetItem("Travel adapter", "electronics"), new PresetItem("Power bank", "electronics"),
                new PresetItem("Dress shoes", "clothing"), new PresetItem("Portfolio/folder", "work")));
        presets.put("umrah", List.of(
                new PresetItem("Ihram", "clothing"), new PresetItem("Prayer mat", "religious"),
                new PresetItem("Quran", "religious"), new PresetItem("Tasbih", "religious"),
                new PresetItem("Comfortable walking shoes", "clothing"), new PresetItem("Sunscreen", "health"),
                new PresetItem("Water bottle", "gear"), new PresetItem("Umbrella", "gear"),
                new PresetItem("Medication", "health"), new PresetItem("Sandals", "clothing")));
        return Map.copyOf(presets);
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
