package com.travelluhh.controller;

import com.travelluhh.dto.fund.FundEntryRequest;
import com.travelluhh.dto.fund.FundEntryResponse;
import com.travelluhh.dto.fund.FundSummaryResponse;
import com.travelluhh.service.FundService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** The travel fund. GET: any member. POST and DELETE: owner or editor. */
@RestController
@RequestMapping("/api/trips/{tripId}/fund")
@RequiredArgsConstructor
public class FundController {

    private final FundService fundService;

    @GetMapping
    public ResponseEntity<FundSummaryResponse> get(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(fundService.getFund(tripId, authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<FundEntryResponse> add(
            @PathVariable Long tripId,
            @Valid @RequestBody FundEntryRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fundService.addEntry(tripId, request, authentication.getName()));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long tripId,
            @PathVariable Long entryId,
            Authentication authentication
    ) {
        fundService.deleteEntry(tripId, entryId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
