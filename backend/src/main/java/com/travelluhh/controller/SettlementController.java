package com.travelluhh.controller;

import com.travelluhh.dto.trip.SettlementResponse;
import com.travelluhh.service.SettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Who owes whom. Any member. */
@RestController
@RequestMapping("/api/trips/{tripId}/settlement")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @GetMapping
    public ResponseEntity<SettlementResponse> getSettlement(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(settlementService.calculate(tripId, authentication.getName()));
    }
}
