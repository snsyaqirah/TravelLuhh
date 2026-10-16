package com.travelluhh.controller;

import com.travelluhh.dto.trip.CreateTripRequest;
import com.travelluhh.dto.trip.TripResponse;
import com.travelluhh.dto.trip.UpdateTripRequest;
import com.travelluhh.service.TripService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Authentication#getName() is the user's email. Access rules live in TripAccessService. */
@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;

    @PostMapping
    public ResponseEntity<TripResponse> createTrip(
            @Valid @RequestBody CreateTripRequest request,
            Authentication authentication
    ) {
        TripResponse response = tripService.createTrip(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** ?archived=false (default) | true | all */
    @GetMapping
    public ResponseEntity<List<TripResponse>> getAllTrips(
            @RequestParam(name = "archived", defaultValue = "false") String archived,
            Authentication authentication
    ) {
        return ResponseEntity.ok(tripService.getAllTripsForUser(authentication.getName(), archived));
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<TripResponse> getTripById(
            @PathVariable Long tripId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(tripService.getTripById(tripId, authentication.getName()));
    }

    @PutMapping("/{tripId}")
    public ResponseEntity<TripResponse> updateTrip(
            @PathVariable Long tripId,
            @Valid @RequestBody UpdateTripRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(tripService.updateTrip(tripId, request, authentication.getName()));
    }

    @DeleteMapping("/{tripId}")
    public ResponseEntity<Void> deleteTrip(
            @PathVariable Long tripId,
            Authentication authentication
    ) {
        tripService.deleteTrip(tripId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
