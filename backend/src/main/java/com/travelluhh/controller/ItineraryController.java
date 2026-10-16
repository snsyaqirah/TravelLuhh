package com.travelluhh.controller;

import com.travelluhh.dto.itinerary.ItineraryItemRequest;
import com.travelluhh.dto.itinerary.ItineraryItemResponse;
import com.travelluhh.service.ItineraryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Reads need membership, writes owner or editor. Item ids are always resolved within {tripId}. */
@RestController
@RequestMapping("/api/trips/{tripId}/itinerary")
@RequiredArgsConstructor
public class ItineraryController {

    private final ItineraryService itineraryService;

    @GetMapping
    public ResponseEntity<List<ItineraryItemResponse>> getItems(
            @PathVariable Long tripId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(itineraryService.getItems(tripId, authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<ItineraryItemResponse> addItem(
            @PathVariable Long tripId,
            @Valid @RequestBody ItineraryItemRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(itineraryService.addItem(tripId, request, authentication.getName()));
    }

    @PutMapping("/{itemId}")
    public ResponseEntity<ItineraryItemResponse> updateItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            @Valid @RequestBody ItineraryItemRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(itineraryService.updateItem(tripId, itemId, request, authentication.getName()));
    }

    @DeleteMapping("/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable Long tripId,
            @PathVariable Long itemId,
            Authentication authentication
    ) {
        itineraryService.deleteItem(tripId, itemId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
