package com.travelluhh.controller;

import com.travelluhh.dto.packing.PackingItemRequest;
import com.travelluhh.dto.packing.PackingItemResponse;
import com.travelluhh.dto.packing.PackingPresetRequest;
import com.travelluhh.service.PackingListService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reads need membership, writes (including toggle) owner or editor. Item ids are resolved within {tripId}. */
@RestController
@RequestMapping("/api/trips/{tripId}/packing")
@RequiredArgsConstructor
public class PackingListController {

    private final PackingListService packingListService;

    @GetMapping
    public ResponseEntity<List<PackingItemResponse>> getItems(
            @PathVariable Long tripId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(packingListService.getItems(tripId, authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<PackingItemResponse> addItem(
            @PathVariable Long tripId,
            @Valid @RequestBody PackingItemRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(packingListService.addItem(tripId, request, authentication.getName()));
    }

    @PatchMapping("/{itemId}/toggle")
    public ResponseEntity<PackingItemResponse> toggleItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(packingListService.toggleItem(tripId, itemId, authentication.getName()));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        packingListService.deleteItem(tripId, itemId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    /** Body {"preset": "beach"} (contract) or the older ?type=beach. Returns only the items added. */
    @PostMapping("/preset")
    public ResponseEntity<List<PackingItemResponse>> addPreset(
            @PathVariable Long tripId,
            @RequestParam(name = "type", required = false) String type,
            @RequestBody(required = false) PackingPresetRequest body,
            Authentication authentication
    ) {
        String preset = body != null && body.getPreset() != null && !body.getPreset().isBlank()
                ? body.getPreset()
                : type;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(packingListService.addPreset(tripId, preset, authentication.getName()));
    }
}
